import express from 'express';
import { RateLimitError } from '../utils/errors.ts';
import { checkRateLimits, recordRequest } from '../services/rateLimitService.ts';
import { asyncMiddleware } from './errorHandler.ts';

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
 * API Key rate limiting middleware
 * Uses per-API-key limits from rate plan
 */
export const apiKeyRateLimitMiddleware = asyncMiddleware(
  async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
    const apiKeyId = (req as any).apiKeyId;
    
    if (!apiKeyId) {
      return next();
    }

    // Check rate limits
    const status = await checkRateLimits(apiKeyId);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', status.limit.toString());
    res.set('X-RateLimit-Remaining', status.remaining.toString());
    res.set('X-RateLimit-Reset', status.resetTime.getTime().toString());

    if (!status.isAllowed) {
      res.set('Retry-After', (status.retryAfter || 60).toString());
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${status.retryAfter} seconds`
      );
    }

    // Record the request
    await recordRequest(apiKeyId);

    next();
  }
);

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
