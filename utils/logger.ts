import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';

const { combine, timestamp, printf, errors } = format;

const myFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} ${level}: ${stack || message}`;
});

const logTransports: any[] = [new transports.Console()];

// Ensure logs directory exists for file transport
const logsDir = path.resolve(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (err) {
  // ignore errors creating logs directory
}

if (process.env.NODE_ENV === 'production') {
  logTransports.push(
    new transports.File({
      filename: path.join(logsDir, 'app.log'),
      level: process.env.LOG_LEVEL || 'info',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    })
  );
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp(), myFormat),
  transports: logTransports,
});

export default logger;
