import express from 'express';
import redis, { isRedisReady } from '../utils/redis.ts';
import logger from '../utils/logger.ts';

interface CacheOptions {
  ttl?: number; // seconds
}

export function cacheResponse(options: CacheOptions = { ttl: 60 }) {
  const ttl = options.ttl ?? 60;

  return async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    // If Redis is not ready, skip cache to avoid errors
    if (!isRedisReady()) {
      return next();
    }

    // Include API key in cache key for per-user caching (security: different users don't share cached responses)
    const apiKey = (req.headers['x-api-key'] as string) || ((req.headers.authorization as string) || '').replace(/^Bearer\s+/, '');
    const safeKeyPart = apiKey ? `${apiKey}:` : 'anon:';
    const key = `cache:${safeKeyPart}${req.originalUrl}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(cached);
      }
    } catch (err) {
      logger.warn('Redis cache read failed', err as any);
    }

    // Capture send to cache the response
    const originalSend = res.send.bind(res);
    (res as any).send = async (body: any) => {
      try {
        if (res.statusCode === 200 && body) {
          const str = typeof body === 'string' ? body : JSON.stringify(body);
          await redis.setex(key, ttl, str);
          res.setHeader('X-Cache', 'MISS');
        }
      } catch (err) {
        logger.warn('Redis cache write failed', err as any);
      }
      return originalSend(body);
    };

    next();
  };
}
