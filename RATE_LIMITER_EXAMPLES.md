# Rate Limiter Configuration Guide

The Redis-backed rate limiter now supports flexible identifier types and weighted limits for per-route control.

## Features

- **IP-based limiting**: Client IP address (respects proxy headers)
- **API Key-based limiting**: Per-API-key quotas
- **Custom identifiers**: User-defined logic (user ID, session, etc.)
- **Weighted requests**: Heavy operations consume more quota
- **Cluster-safe**: Redis-backed, works across multiple instances

## Configuration Options

```typescript
interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Max requests (or weighted units) per window
  message?: string;        // Custom error message
  weight?: number;         // Request cost multiplier (default 1)
  identifierType?: 'ip' | 'apiKey' | 'custom';
  identifierFn?: (req) => string; // Custom identifier extractor
}
```

## Pre-configured Limiters

### 1. Auth Limiter (IP-based)
- **5 requests per 15 minutes**
- Used for login/register endpoints
- IP-based identification

```typescript
import { authRateLimiter } from './middlewares/rateLimiter.ts';

router.post('/login', authRateLimiter, loginHandler);
```

### 2. API Limiter (IP-based)
- **100 requests per minute**
- Default for general API endpoints
- IP-based identification

```typescript
import { apiRateLimiter } from './middlewares/rateLimiter.ts';

router.get('/data', apiRateLimiter, dataHandler);
```

### 3. API Key Global Limiter
- **1000 requests per minute**
- Per-API-key limits (for authenticated users)
- Used with API key authentication

```typescript
import { apiKeyGlobalRateLimiter } from './middlewares/rateLimiter.ts';

router.get('/expensive-endpoint', apiKeyGlobalRateLimiter, expensiveHandler);
```

### 4. Heavy Operation Limiter
- **50 weighted units per minute** (each request costs 5 units)
- ~10 heavy requests per minute max
- For expensive operations

```typescript
import { heavyOperationRateLimiter } from './middlewares/rateLimiter.ts';

router.post('/bulk-export', heavyOperationRateLimiter, bulkExportHandler);
```

## Custom Usage Examples

### Example 1: Per-route with custom identifier (User ID)

```typescript
import { createRateLimiter } from './middlewares/rateLimiter.ts';
import express from 'express';

const userRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  identifierType: 'custom',
  identifierFn: (req) => {
    return (req as any).userId || 'anonymous';
  },
  message: 'User request limit exceeded',
});

router.post('/submit-form', userRateLimiter, formHandler);
```

### Example 2: Weighted limits for expensive operations

```typescript
const dbQueryLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100, // 100 weighted units per minute
  weight: 10, // each DB query costs 10 units
  identifierType: 'apiKey',
  message: 'Database query rate limit exceeded',
});

router.post('/query', dbQueryLimiter, queryHandler);
```

### Example 3: Combination - API Key with weight and fallback

```typescript
const combinedLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 500,
  weight: 2, // requests cost 2 units each
  identifierType: 'custom',
  identifierFn: (req) => {
    // Use API key if available, fallback to IP
    return (req as any).apiKeyId || req.ip || 'unknown';
  },
});

router.post('/hybrid', combinedLimiter, hybridHandler);
```

## Environment Configuration

```env
# Express trust proxy setting for IP extraction
# Set to 1 for single proxy, or number of proxies in chain
TRUST_PROXY=1

# Redis connection
REDIS_URL=redis://127.0.0.1:6379

# Redis health check interval (seconds), 0 to disable
REDIS_HEALTH_CHECK_INTERVAL=30

# Node environment
NODE_ENV=production
```

## Headers

All rate-limited endpoints return:

```
X-RateLimit-Limit: 100          # Total limit for window
X-RateLimit-Remaining: 42       # Remaining requests/units
X-RateLimit-Reset: 1702000000000 # Reset timestamp (ms)
X-RateLimit-Weight: 1           # Cost of this request
Retry-After: 45                 # Seconds to wait (on 429)
```

## Rate Limit Exceeded Response

When a rate limit is exceeded:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Too many requests. Please try again in 45 seconds"
  }
}
```

HTTP Status: **429 Too Many Requests**

## Best Practices

1. **Use IP limiting for public endpoints** → prevents abuse from bad actors
2. **Use API Key limiting for authenticated endpoints** → enforces per-customer quotas
3. **Use weights for expensive operations** → protects backend resources
4. **Monitor headers** → client can see remaining quota in `X-RateLimit-Remaining`
5. **Set appropriate windows** → 15-60 minutes for auth, 1 minute for general APIs
6. **Configure trust proxy** → ensures correct IP extraction behind load balancers

## Migration from In-Memory Limiter

The old Map-based in-memory limiter has been replaced with Redis. Benefits:

- ✅ Cluster-safe (works across multiple instances)
- ✅ Persistent across restarts
- ✅ Fine-grained control (weights, custom identifiers)
- ✅ Flexible Redis connection options
- ✅ Fallback to database if Redis fails

## Troubleshooting

### "Too many requests" immediately

- Check Redis connectivity: `GET /health`
- Verify `TRUST_PROXY` setting for correct IP extraction
- Check if using correct identifier type

### Rate limit not resetting

- Verify Redis TTL is set correctly
- Check Redis clock sync with app server
- Monitor Redis memory usage

### Different limits across instances

- Ensure all instances point to same Redis URL
- Check Redis connectivity on each instance
