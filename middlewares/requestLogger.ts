import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.ts';

export default function requestLogger(req: express.Request, res: express.Response, next: express.NextFunction) {
  const requestId = uuidv4();
  (req as any).requestId = requestId;
  
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    try {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      const meta = {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: durationMs.toFixed(2),
        ip: req.ip,
        userAgent: req.get('user-agent'),
      };
      
      if (res.statusCode >= 500) {
        logger.error(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta as any);
      } else if (res.statusCode >= 400) {
        logger.warn(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta as any);
      } else {
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta as any);
      }
    } catch (err) {
      logger.error('Failed to log request', err as any);
    }
  });

  next();
}
