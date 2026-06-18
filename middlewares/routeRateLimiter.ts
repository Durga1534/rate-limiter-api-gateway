/**
 * Route-specific Rate Limiting Configuration
 * Define custom rate limits for specific routes using regex patterns
 */

import { asyncMiddleware } from './errorHandler.ts';
import { RateLimitError } from '../utils/errors.ts';
import express from 'express';

export interface RouteRateLimit {
  pattern: RegExp; // Route pattern to match
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burstLimit?: number;
}

/**
 * In-memory cache for route-specific limits.
 * Sliding window approximation using two adjacent buckets.
 */
const routeLimitCache = new Map<
  string,
  { currCount: number; prevCount: number; currBucketStart: number; prevBucketStart: number }
>();

function getBucketStart(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * Create a route-specific rate limiter
 * This overrides the default rate plan limits for matched routes
 */
export function createRouteRateLimiter(routeLimits: RouteRateLimit[]) {
  return asyncMiddleware(
    async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      const apiKeyId = (req as any).apiKeyId;
      if (!apiKeyId) {
        return next();
      }

      const routePath = req.path;

      // Find matching route configuration
      const matchedLimit = routeLimits.find((limit) => limit.pattern.test(routePath));

      if (!matchedLimit) {
        // Use default rate plan limits
        return next();
      }

      const now = Date.now();

      // Sliding window only implemented for requestsPerMinute (current router uses minute)
      if (matchedLimit.requestsPerMinute) {
        const windowMs = 60 * 1000;
        const bucketStart = getBucketStart(now, windowMs);
        const prevBucketStart = bucketStart - windowMs;

        const cacheKeyCurr = `${apiKeyId}:${routePath}:minute:${bucketStart}`;
        const cacheKeyPrev = `${apiKeyId}:${routePath}:minute:${prevBucketStart}`;

        const currCount = routeLimitCache.get(cacheKeyCurr)?.currCount ?? 0;
        const prevCount = routeLimitCache.get(cacheKeyPrev)?.prevCount ?? 0;

        const fractionPrev = (bucketStart + windowMs - now) / windowMs; // 1..0
        const estimatedUsed = currCount + prevCount * Math.max(0, Math.min(1, fractionPrev));
        const nextCount = estimatedUsed + 1;

        const limit = matchedLimit.requestsPerMinute;
        if (nextCount > limit) {
          const resetTime = bucketStart + windowMs;
          const retryAfter = Math.ceil((resetTime - now) / 1000);
          res.set('Retry-After', retryAfter.toString());
          throw new RateLimitError(
            `Rate limit exceeded for this endpoint. Try again in ${retryAfter} seconds`
          );
        }

        // Record into current bucket (simple in-memory)
        routeLimitCache.set(cacheKeyCurr, {
          currCount: currCount + 1,
          prevCount: prevCount,
          currBucketStart: bucketStart,
          prevBucketStart,
        });
      }

      // Set headers based on current estimate for the minute window
      if (matchedLimit.requestsPerMinute) {
        const windowMs = 60 * 1000;
        const bucketStart = getBucketStart(now, windowMs);
        const prevBucketStart = bucketStart - windowMs;

        const cacheKeyCurr = `${apiKeyId}:${routePath}:minute:${bucketStart}`;
        const cacheKeyPrev = `${apiKeyId}:${routePath}:minute:${prevBucketStart}`;

        const currCount = routeLimitCache.get(cacheKeyCurr)?.currCount ?? 0;
        const prevCount = routeLimitCache.get(cacheKeyPrev)?.prevCount ?? 0;

        const fractionPrev = (bucketStart + windowMs - now) / windowMs;
        const estimatedUsed = currCount + prevCount * Math.max(0, Math.min(1, fractionPrev));

        const limit = matchedLimit.requestsPerMinute;
        const remaining = Math.max(0, Math.ceil(limit - estimatedUsed));

        res.set('X-RateLimit-Limit', limit.toString());
        res.set('X-RateLimit-Remaining', remaining.toString());
        res.set('X-RateLimit-Reset', (bucketStart + windowMs).toString());
      }

      next();
    }
  );
}

/**
 * Predefined route-specific limits
 * Example patterns for common endpoints
 */
export const defaultRouteLimits: RouteRateLimit[] = [
  {
    pattern: /^\/api\/v1\/ping$/,
    requestsPerMinute: 60, // Allow 60 pings per minute
    requestsPerHour: 1000,
    requestsPerDay: 10000,
  },
  {
    pattern: /^\/api\/v1\/data.*/, // Match /api/v1/data/* endpoints
    requestsPerMinute: 30,
    requestsPerHour: 500,
    requestsPerDay: 5000,
  },
  {
    pattern: /^\/api\/v1\/admin.*/, // Admin endpoints - more restrictive
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 1000,
  },
  {
    pattern: /^\/api\/v1\/upload.*/, // Upload endpoints - very restrictive
    requestsPerMinute: 5,
    requestsPerHour: 50,
    requestsPerDay: 500,
  },
];

/**
 * Validate that a request matches a route limit
 */
export function matchesRoute(path: string, pattern: RegExp): boolean {
  return pattern.test(path);
}

/**
 * Get the rate limit configuration for a specific route
 */
export function getRouteLimit(path: string, limits: RouteRateLimit[]): RouteRateLimit | undefined {
  return limits.find((limit) => limit.pattern.test(path));
}

/**
 * Cleanup old cache entries (call periodically)
 */
export function cleanupRouteLimitCache(): void {
  const now = Date.now();
  for (const [key, record] of routeLimitCache.entries()) {
    // remove entries older than 5 minutes based on current bucket start
    if (record.currBucketStart + 5 * 60 * 1000 < now) {
      routeLimitCache.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRouteLimitCache, 5 * 60 * 1000);

