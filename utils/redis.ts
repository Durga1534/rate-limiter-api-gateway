import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';


const redis = new Redis(redisUrl, {
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

let lastErrorLog = 0;
redis.on('connect', () => {
  // eslint-disable-next-line no-console
  console.log('[Redis] connected');
});
redis.on('ready', () => {
  // eslint-disable-next-line no-console
  console.log('[Redis] ready');
});
redis.on('error', (err) => {
  const now = Date.now();
  // log at most once every 5 seconds to avoid spamming
  if (now - lastErrorLog > 5000) {
    // eslint-disable-next-line no-console
    console.error('[Redis] error', err && (err.message || err));
    lastErrorLog = now;
  }
});

export function isRedisReady(): boolean {
  return redis.status === 'ready';
}

export default redis;
