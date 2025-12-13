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
 * In-memory cache for route-specific limits
 * In production, this would be in Redis
 */
const routeLimitCache = new Map<string, { count: number; resetTime: number }>();

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

      // Create a route-specific cache key
      const cacheKey = `${apiKeyId}:${routePath}`;
      const now = Date.now();

      // Check minute limit
      if (matchedLimit.requestsPerMinute) {
        const key = `${cacheKey}:minute`;
        const record = routeLimitCache.get(key);

        if (!record || record.resetTime < now) {
          routeLimitCache.set(key, {
            count: 1,
            resetTime: now + 60 * 1000,
          });
        } else {
          record.count++;
          if (record.count > matchedLimit.requestsPerMinute) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            res.set('Retry-After', retryAfter.toString());
            throw new RateLimitError(
              `Rate limit exceeded for this endpoint. Try again in ${retryAfter} seconds`
            );
          }
        }
      }

      // Set rate limit headers based on route limits
      if (matchedLimit.requestsPerMinute) {
        const key = `${cacheKey}:minute`;
        const record = routeLimitCache.get(key);
        if (record) {
          res.set('X-RateLimit-Limit', matchedLimit.requestsPerMinute.toString());
          res.set(
            'X-RateLimit-Remaining',
            Math.max(0, matchedLimit.requestsPerMinute - record.count).toString()
          );
          res.set('X-RateLimit-Reset', record.resetTime.toString());
        }
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
    if (record.resetTime < now) {
      routeLimitCache.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRouteLimitCache, 5 * 60 * 1000);
