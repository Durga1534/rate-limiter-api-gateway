import Redis from 'ioredis';

// Use local Redis for now - QStash was causing memory issues
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redis = new Redis(redisUrl, {
  retryStrategy(times) {
    if (times > 50) return null;
    return Math.min(2000, 50 * times);
  },
  enableOfflineQueue: false,
  maxRetriesPerRequest: null,
});

let lastErrorLog = 0;
redis.on('connect', () => {
  console.log('[Redis] connected');
});
redis.on('ready', () => {
  console.log('[Redis] ready');
});
redis.on('error', (err: any) => {
  const now = Date.now();
  if (now - lastErrorLog > 5000) {
    console.error('[Redis] error', err && (err.message || err));
    lastErrorLog = now;
  }
});

// Health check function
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
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
  return redis.status === 'ready';
}

export default redis;
