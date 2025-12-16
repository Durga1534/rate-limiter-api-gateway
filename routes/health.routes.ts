import express from 'express';
import redis, { isRedisReady } from '../utils/redis.ts';

const router = express.Router();

router.get('/', async (_req, res) => {
  const redisReady = isRedisReady();
  const redisInfo: any = { connected: redisReady };

  try {
    const pong = await redis.ping();
    redisInfo.pong = pong;
  } catch (err: any) {
    redisInfo.error = err && (err.message || String(err));
    redisInfo.connected = false;
  }

  res.json({
    status: 'ok',
    redis: redisInfo,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
  });
});

export default router;
