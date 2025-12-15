import express from 'express';
import logger from '../utils/logger.ts';

export default function requestLogger(req: express.Request, res: express.Response, next: express.NextFunction) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    try {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      const meta = {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: durationMs.toFixed(2),
        ip: req.ip,
      };
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta as any);
    } catch (err) {
      logger.error('Failed to log request', err as any);
    }
  });

  next();
}
