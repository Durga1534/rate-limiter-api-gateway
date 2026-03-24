import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number()).default(() => 5050),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://127.0.0.1:6379'),
  REDIS_HEALTH_CHECK_INTERVAL: z.string().transform(Number).pipe(z.number()).default(() => 30),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Sentry (optional)
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.string().transform(Number).pipe(z.number()).default(() => 0.1),
  
  // Rate Limiting
  TRUST_PROXY: z.union([z.string(), z.number()]).default('1'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Type inference
export type Env = z.infer<typeof envSchema>;

// Validate and export environment variables
function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// Export validated environment
export const env = validateEnv();

// Helper function to get environment variable with type safety
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  return env[key];
}

// Export common environment getters for convenience
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const databaseConfig = {
  url: env.DATABASE_URL,
};

export const redisConfig = {
  url: env.REDIS_URL,
  healthCheckInterval: env.REDIS_HEALTH_CHECK_INTERVAL * 1000,
};

export const jwtConfig = {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
};

export const serverConfig = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  trustProxy: env.TRUST_PROXY,
};

export const sentryConfig = {
  dsn: env.SENTRY_DSN,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  environment: env.NODE_ENV,
};

export const corsConfig = {
  origin: env.CORS_ORIGIN,
};

export const loggingConfig = {
  level: env.LOG_LEVEL,
};
