import express from 'express';
import { RateLimitError } from '../utils/errors.ts';
import { checkRateLimits, recordRequest } from '../services/rateLimitService.ts';
import { asyncMiddleware } from './errorHandler.ts';
import redis from '../utils/redis.ts';

interface RateLimitConfig {
  windowMs: number; 
  maxRequests: number; 
  message?: string;
  weight?: number; 
  identifierType?: 'ip' | 'apiKey' | 'custom';
  identifierFn?: (req: express.Request) => string;
}

/**
 * Helper: safely extract client IP considering proxy headers
 */
function getClientIp(req: express.Request): string {
  // req.ip is populated by Express if trust proxy is configured
  if (req.ip) return req.ip;
  // Fallback to x-forwarded-for if available
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return 'unknown';
}

/**
 * Redis-backed global rate limiter (cluster-safe)
 * Supports IP-based, API-key-based, or custom identifier-based limiting with optional weights
 * Uses keys of the form: `rl:{identifier}:{bucketStart}`
 */
export function createRateLimiter(config: RateLimitConfig) {
  const weight = config.weight || 1;
  const identifierType = config.identifierType || 'ip';

  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
     let identifier: string;

      if (identifierType === 'apiKey') {
        identifier = (req as any).apiKeyId || 'unknown';
        if(identifier === 'unknown') {
          throw new RateLimitError('API key missing for rate limiting');
        }  
      } else if (identifierType === 'custom' && config.identifierFn) {
        identifier = config.identifierFn(req);
      } else {
        // default to IP
        identifier = getClientIp(req);
      }

      const now = Date.now();
      const windowMs = config.windowMs;

      // Sliding window using two adjacent buckets with time-weighting.
      // current bucket covers [bucketStart, bucketStart + windowMs)
      const bucketStart = Math.floor(now / windowMs) * windowMs;
      const prevBucketStart = bucketStart - windowMs;

      const keyCurr = `rl:${identifier}:${bucketStart}`;
      const keyPrev = `rl:${identifier}:${prevBucketStart}`;

      const elapsedInCurr = now - bucketStart; // [0..windowMs)
      const fractionCurr = elapsedInCurr / windowMs; // 0..1
      const fractionPrev = 1 - fractionCurr;

      // Weighted estimate of how many requests have been made in the last window.
      // Note: we evaluate before writing to avoid fixed-window behavior.
      const pipeline = redis.pipeline();
      pipeline.get(keyCurr);
      pipeline.get(keyPrev);
      const results = await pipeline.exec();

      // ioredis returns: Array<[Error|null, result]> | null
      const countCurrRaw = (results && results[0] && results[0][0] == null ? results[0][1] : null) as unknown;
      const countPrevRaw = (results && results[1] && results[1][0] == null ? results[1][1] : null) as unknown;

      const countCurr = countCurrRaw != null ? (parseInt(countCurrRaw as any, 10) || 0) : 0;
      const countPrev = countPrevRaw != null ? (parseInt(countPrevRaw as any, 10) || 0) : 0;

      const estimated = countCurr + countPrev * fractionPrev;
      const remaining = Math.max(0, Math.ceil(config.maxRequests - (estimated + weight)));
      const reset = bucketStart + windowMs;

      res.set('X-RateLimit-Limit', config.maxRequests.toString());
      res.set('X-RateLimit-Remaining', remaining.toString());
      res.set('X-RateLimit-Reset', reset.toString());
      res.set('X-RateLimit-Weight', weight.toString());

      const limitAfterThisRequest = estimated + weight;
      if (limitAfterThisRequest > config.maxRequests) {
        const retryAfter = Math.ceil((reset - now) / 1000);
        res.set('Retry-After', retryAfter.toString());
        throw new RateLimitError(
          config.message || `Too many requests. Please try again in ${retryAfter} seconds`
        );
      }

      // Record request in current bucket.
      const pipeline2 = redis.pipeline();
      pipeline2.incrby(keyCurr, weight);
      const ttlSecondsCurr = Math.ceil((windowMs - (now - bucketStart)) / 1000);
      pipeline2.expire(keyCurr, ttlSecondsCurr, 'GT');
      // Ensure prev bucket doesn't linger forever if we're late into the window.
      const ttlSecondsPrev = Math.ceil((windowMs - (now - prevBucketStart)) / 1000);
      if (ttlSecondsPrev > 0) {
        pipeline2.expire(keyPrev, ttlSecondsPrev, 'GT');
      }
      // Execute and ignore results.
      await pipeline2.exec();

      return next();
    } catch (error) {
      return next(error);
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

// Auth limiter: IP-based, 5 requests per 15 minutes
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  identifierType: 'ip',
  message: 'Too many login/register attempts. Please try again later.',
});

// Global API limiter: IP-based, 100 requests per minute
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  identifierType: 'ip',
});

// API Key limiter: API-key-based, 1000 requests per minute with weight support
export const apiKeyGlobalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 1000,
  identifierType: 'apiKey',
  weight: 1,
});

// Heavy request limiter: higher cost operations (weight=5), lower limit
export const heavyOperationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 50, // 50 weighted units per minute
  weight: 5, // each request costs 5 units
  identifierType: 'ip',
  message: 'Heavy operation rate limit exceeded. Try again later.',
});
