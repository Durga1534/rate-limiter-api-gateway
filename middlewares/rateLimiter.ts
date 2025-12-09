/**
 * In-memory rate limiting middleware
 * For production, use Redis or a dedicated service like rate-limit-redis
 */

import express from 'express';
import { RateLimitError } from '../utils/errors.ts';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

const store = new Map<string, RequestRecord>();

// Cleanup old entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (record.resetTime < now) {
      store.delete(key);
    }
  }
}, 60000);

export function createRateLimiter(config: RateLimitConfig) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const key = req.ip || 'unknown';
      const now = Date.now();
      const record = store.get(key);

      if (!record || record.resetTime < now) {
        // New window or window expired
        store.set(key, {
          count: 1,
          resetTime: now + config.windowMs,
        });
        return next();
      }

      record.count++;

      if (record.count > config.maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        res.set('Retry-After', retryAfter.toString());
        throw new RateLimitError(
          config.message || `Too many requests. Please try again in ${retryAfter} seconds`
        );
      }

      res.set('X-RateLimit-Limit', config.maxRequests.toString());
      res.set('X-RateLimit-Remaining', (config.maxRequests - record.count).toString());
      res.set('X-RateLimit-Reset', record.resetTime.toString());

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Pre-configured rate limiters
 */

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 requests per 15 minutes
  message: 'Too many login/register attempts. Please try again later.',
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});
