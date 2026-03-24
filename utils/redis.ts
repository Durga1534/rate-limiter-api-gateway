import Redis from 'ioredis';
import { redisConfig } from './env.ts';
import { getRedisClient as getQStashClient } from './qstashRedis.ts';

// Try to use QStash REST API first, fall back to Redis protocol
let redis: Redis | any = null;
let isQStash = false;

if (redisConfig.restUrl && redisConfig.restToken) {
  console.log('🔴 Using QStash Redis REST API');
  redis = getQStashClient();
  isQStash = true;
} else {
  console.log('🔴 Using Redis protocol');
  isQStash = false;
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  redis = new Redis(redisUrl, {
    // exponential backoff for reconnect attempts (ms)
    retryStrategy(times) {
      if (times > 50) return null;
      return Math.min(2000, 50 * times);
    },
    // don't queue commands when offline (fail fast in app logic)
    enableOfflineQueue: false,
    // Allow many retries per request by default
    maxRetriesPerRequest: null,
  });
}

// Only add event listeners for Redis protocol, not QStash
if (!isQStash) {
  let lastErrorLog = 0;
  redis.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('[Redis] connected');
  });
  redis.on('ready', () => {
    // eslint-disable-next-line no-console
    console.log('[Redis] ready');
  });
  redis.on('error', (err: any) => {
    const now = Date.now();
    // log at most once every 5 seconds to avoid spamming
    if (now - lastErrorLog > 5000) {
      // eslint-disable-next-line no-console
      console.error('[Redis] error', err && (err.message || err));
      lastErrorLog = now;
    }
  });
}

// Health check function
export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (isQStash) {
      // QStash health check
      return await redis.ping();
    } else {
      // Redis protocol health check
      await redis.ping();
      return true;
    }
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeRedisConnection(): Promise<void> {
  try {
    if (redis && typeof redis.quit === 'function') {
      await redis.quit();
    }
  } catch (error) {
    console.error('Error closing Redis connection:', error);
  }
}

export function isRedisReady(): boolean {
  if (isQStash) {
    return true; // QStash doesn't have ready state
  }
  return redis.status === 'ready';
}

export default redis;
