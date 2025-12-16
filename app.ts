import express from "express";
import * as Sentry from '@sentry/node';
import authRoutes from "./routes/auth.routes.ts";
import apiKeyRoutes from "./routes/apiKey.routes.ts";
import protectedRoutes from "./routes/protected.routes.ts";
import healthRoutes from './routes/health.routes.ts';
import { errorHandler } from "./middlewares/errorHandler.ts";
import mountSwagger from './middlewares/swagger.ts';
import requestLogger from './middlewares/requestLogger.ts';
import { cacheResponse } from './middlewares/cache.ts';
import redis, { isRedisReady } from './utils/redis.ts';
import logger from './utils/logger.ts';

const app = express();

// Configure trust proxy to properly extract client IP from headers when behind proxies
// Set to 1 for single proxy, or 'loopback' for local proxies only, or custom function
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', process.env.TRUST_PROXY || 1);
} else {
  app.set('trust proxy', 'loopback');
}

// Initialize Sentry if DSN is provided
let sentryInitialized = false;
if (process.env.SENTRY_DSN) {
	try {
		Sentry.init({
			dsn: process.env.SENTRY_DSN,
			environment: process.env.NODE_ENV || 'development',
			tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
		});
		logger.info('✓ Sentry initialized for error tracking');
		sentryInitialized = true;
	} catch (err: any) {
		logger.error('Failed to initialize Sentry:', err && (err.message || err));
	}
}
	// Optional Redis health check logging at startup and periodically
	const redisHealthInterval = Number(process.env.REDIS_HEALTH_CHECK_INTERVAL || 0);
	if (redisHealthInterval > 0) {
		const checkRedis = async () => {
			try {
				const pong = await redis.ping();
				logger.info(`Redis health check: pong=${pong} status=${isRedisReady() ? 'ready' : redis.status}`);
			} catch (err: any) {
				logger.error('Redis health check failed:', err && (err.message || err));
			}
		};
		// run immediately (in background) and then periodically
		checkRedis().catch((err) => {
			logger.warn('Initial Redis health check encountered error', err);
		});
		setInterval(checkRedis, redisHealthInterval * 1000);
	}

app.use(express.json());

// Capture request ID in Sentry context (handlers optional if not available)
if (sentryInitialized) {
	app.use((req: any, _res, next) => {
		const requestId = req.requestId;
		if (requestId) {
			Sentry.setTag('requestId', requestId);
		}
		next();
	});
}

// Swagger UI (OpenAPI)
mountSwagger(app);

// Request logging
app.use(requestLogger);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/api-keys", apiKeyRoutes);
app.use("/api/v1", protectedRoutes);

// Health check (redis, uptime)
app.use('/health', healthRoutes);

// Optional: lightweight cache for GET endpoints (mounted AFTER protected routes so rate-limiter runs first)
app.use(cacheResponse({ ttl: 60 }));

// Error handling middleware (must be last)
// Sentry will automatically capture errors from our errorHandler
app.use(errorHandler);

export default app;
