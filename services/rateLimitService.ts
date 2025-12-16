/**
 * Advanced Rate Limiting Service
 * Handles per-user, time-window based rate limiting with database persistence
 */

import { prisma } from '../prisma.ts';
import redis from '../utils/redis.ts';

export interface RateLimitConfig {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burstLimit?: number;
}

export interface RateLimitStatus {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

/**
 * Get the bucket timestamp for a given period
 */
function getBucketTimestamp(period: 'MINUTE' | 'HOUR' | 'DAY'): Date {
  const now = new Date();
  switch (period) {
    case 'MINUTE':
      now.setSeconds(0, 0);
      return now;
    case 'HOUR':
      now.setMinutes(0, 0, 0);
      return now;
    case 'DAY':
      now.setHours(0, 0, 0, 0);
      return now;
  }
}

/**
 * Get the next reset time for a given period
 */
function getResetTime(period: 'MINUTE' | 'HOUR' | 'DAY'): Date {
  const bucket = getBucketTimestamp(period);
  switch (period) {
    case 'MINUTE':
      bucket.setMinutes(bucket.getMinutes() + 1);
      return bucket;
    case 'HOUR':
      bucket.setHours(bucket.getHours() + 1);
      return bucket;
    case 'DAY':
      bucket.setDate(bucket.getDate() + 1);
      return bucket;
  }
}

/**
 * Check rate limit for a given API key and period
 */
async function checkPeriodLimit(
  apiKeyId: string,
  period: 'MINUTE' | 'HOUR' | 'DAY',
  limit: number
): Promise<RateLimitStatus> {
  if (limit === 0) {
    return {
      isAllowed: true,
      limit: 0,
      remaining: 0,
      resetTime: new Date(),
    };
  }
  const bucket = getBucketTimestamp(period);
  const resetTime = getResetTime(period);

  // Use Redis for counters
  try {
    const key = `usage:${apiKeyId}:${period}:${bucket.getTime()}`;
    const countStr = await redis.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;

    const remaining = Math.max(0, limit - count);
    const isAllowed = count < limit;

    return {
      isAllowed,
      limit,
      remaining,
      resetTime,
    };
  } catch (err) {
    // If Redis unavailable, fall back to DB to avoid hard failure
    const bucket2 = bucket;
    const usage = await prisma.usage.findFirst({
      where: {
        apiKeyId,
        peroid: period,
        timestampBucket: bucket2,
      },
    });

    const dbCount = usage ? usage.requestCount : 0;
    const remaining = Math.max(0, limit - dbCount);
    const isAllowed = dbCount < limit;

    return {
      isAllowed,
      limit,
      remaining,
      resetTime,
    };
  }
}

/**
 * Increment request count for a given API key and period
 */
async function incrementCounter(
  apiKeyId: string,
  period: 'MINUTE' | 'HOUR' | 'DAY'
): Promise<void> {
  const bucket = getBucketTimestamp(period);
  const resetTime = getResetTime(period);

  const key = `usage:${apiKeyId}:${period}:${bucket.getTime()}`;

  try {
    const ttl = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttl);
    await pipeline.exec();
  } catch (err) {
    // Fallback to DB increment if Redis fails
    await prisma.usage.updateMany({
      where: {
        apiKeyId,
        peroid: period,
        timestampBucket: bucket,
      },
      data: {
        requestCount: {
          increment: 1,
        },
      },
    });
  }
}

/**
 * Check if API key is within rate limits based on its rate plan
 * Returns the most restrictive limit status
 */
export async function checkRateLimits(apiKeyId: string): Promise<RateLimitStatus> {
  // Get API key with rate plan
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    include: { plan: true },
  });

  if (!apiKey) {
    throw new Error('API Key not found');
  }

  const plan = apiKey.plan;

  // Check all period limits
  const minuteStatus = await checkPeriodLimit(apiKeyId, 'MINUTE', plan.requestsPerMinute);
  const hourStatus = await checkPeriodLimit(apiKeyId, 'HOUR', plan.requestsPerHour);
  const dayStatus = await checkPeriodLimit(apiKeyId, 'DAY', plan.requestsPerDay);

  // If any limit is exceeded, return that status
  if (!minuteStatus.isAllowed) {
    return {
      ...minuteStatus,
      retryAfter: Math.ceil((minuteStatus.resetTime.getTime() - Date.now()) / 1000),
    };
  }

  if (!hourStatus.isAllowed) {
    return {
      ...hourStatus,
      retryAfter: Math.ceil((hourStatus.resetTime.getTime() - Date.now()) / 1000),
    };
  }

  if (!dayStatus.isAllowed) {
    return {
      ...dayStatus,
      retryAfter: Math.ceil((dayStatus.resetTime.getTime() - Date.now()) / 1000),
    };
  }

  // All limits passed, return the most restrictive remaining
  const mostRestrictive = [minuteStatus, hourStatus, dayStatus].sort(
    (a, b) => a.remaining - b.remaining
  )[0];

  return {
    isAllowed: true,
    limit: mostRestrictive.limit,
    remaining: mostRestrictive.remaining,
    resetTime: mostRestrictive.resetTime,
  };
}

/**
 * Record a request for an API key (increments all period counters)
 */
export async function recordRequest(apiKeyId: string): Promise<void> {
  await Promise.all([
    incrementCounter(apiKeyId, 'MINUTE'),
    incrementCounter(apiKeyId, 'HOUR'),
    incrementCounter(apiKeyId, 'DAY'),
  ]);
}

/**
 * Log API request details
 */
export async function logRequest(
  apiKeyId: string,
  endpoint: string,
  statusCode: number,
  responseTimeMs: number,
  ip?: string
): Promise<void> {
  await prisma.requestLog.create({
    data: {
      apiKeyId,
      endPoint: endpoint,
      statusCode,
      responseTimeMs,
      ip,
    },
  });
}

/**
 * Get usage statistics for an API key
 */
export async function getUsageStats(apiKeyId: string) {
  const logs = await prisma.requestLog.findMany({
    where: { apiKeyId },
  });

  const usage = await prisma.usage.findMany({
    where: { apiKeyId },
    orderBy: { timestampBucket: 'desc' },
    take: 3,
  });

  return {
    totalRequests: logs.length,
    usage: usage.map((u) => ({
      period: u.peroid,
      count: u.requestCount,
      bucket: u.timestampBucket,
    })),
    recentRequests: logs.slice(-10).map((log) => ({
      endpoint: log.endPoint,
      statusCode: log.statusCode,
      responseTime: log.responseTimeMs,
      timestamp: log.createdAt,
    })),
  };
}
