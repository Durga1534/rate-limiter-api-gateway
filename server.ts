import "dotenv/config";
import app from "./app.ts";
import logger from './utils/logger.ts';
import redis, { isRedisReady } from './utils/redis.ts';
import { prisma } from './prisma.ts';

// Validate required environment variables
function validateEnvironment() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET!.length < 32) {
    logger.error('JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
  
  logger.info('Environment validation passed');
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

// Test database connection
async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection successful');
  } catch (err: any) {
    logger.error('Database connection failed:', err && (err.message || err));
    process.exit(1);
  }
}

// Wait for Redis to be ready
async function waitForRedis(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    if (isRedisReady()) {
      logger.info('Redis ready for rate limiting');
      return;
    }
    logger.warn(`Waiting for Redis... attempt ${i + 1}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  logger.warn('Redis not ready, continuing with fallback');
}

const PORT = parseInt(process.env.PORT || "5050", 10);

// Startup sequence
(async () => {
  try {
    validateEnvironment();
    await testDatabaseConnection();
    await waitForRedis();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✓ Server is running on http://localhost:${PORT}`);
      logger.info(`✓ Node environment: ${process.env.NODE_ENV || 'development'}`);
    });

    server.on('error', (err: any) => {
      logger.error('Server error:', err && (err.message || err));
      process.exit(1);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, gracefully shutting down...`);
      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          await prisma.$disconnect();
          logger.info('Database connection closed');
        } catch (err) {
          logger.error('Error closing database:', err);
        }
        try {
          redis.disconnect();
          logger.info('Redis connection closed');
        } catch (err) {
          logger.error('Error closing Redis:', err);
        }
        logger.info('Graceful shutdown complete');
        process.exit(0);
      });
      
      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err: any) {
    logger.error('Startup failed:', err && (err.message || err));
    process.exit(1);
  }
})();