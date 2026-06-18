import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';

const { combine, timestamp, printf, errors } = format;

/**
 * Structured logging format for production
 * Outputs JSON for easy parsing by log aggregation services
 */
const structuredFormat = printf(({ level, message, timestamp: ts, stack, requestId, userId, ...meta }) => {
  const log: Record<string, unknown> = {
    timestamp: ts,
    level,
    message,
    requestId: requestId || undefined,
    userId: userId || undefined,
    stack: stack || undefined,
    ...meta,
  };

  // Filter out undefined values
  Object.entries(log).forEach(([key, value]) => value === undefined && delete log[key]);

  return JSON.stringify(log);
});

/**
 * Human-readable format for development
 */
const devFormat = printf(({ level, message, timestamp: ts, stack, requestId }) => {
  const prefix = requestId ? `[${requestId}]` : '';
  return `${ts} ${level.toUpperCase()} ${prefix}: ${stack || message}`;
});

const logTransports: any[] = [
  new transports.Console({
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      process.env.NODE_ENV === 'production' ? structuredFormat : devFormat
    ),
  }),
];

// Ensure logs directory exists for file transport
const logsDir = path.resolve(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // File transport for errors
  logTransports.push(
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      format: combine(errors({ stack: true }), timestamp(), structuredFormat),
    })
  );

  // File transport for all logs (production only)
  if (process.env.NODE_ENV === 'production') {
    logTransports.push(
      new transports.File({
        filename: path.join(logsDir, 'app.log'),
        level: process.env.LOG_LEVEL || 'info',
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
        format: combine(errors({ stack: true }), timestamp(), structuredFormat),
      })
    );
  }
} catch (err) {
  console.error('Failed to setup file logging:', err);
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true })),
  defaultMeta: { service: 'rate-limiting-api' },
  transports: logTransports,
});

/**
 * Log with additional context
 */
export const logWithContext = (
  level: string,
  message: string,
  context?: Record<string, any>
) => {
  logger.log(level, message, context);
};

export default logger;
