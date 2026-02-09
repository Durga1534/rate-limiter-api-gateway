# Rate Limiter API Gateway - Architecture & Implementation Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Feature Implementations](#feature-implementations)
4. [Database Design](#database-design)
5. [Authentication & Security](#authentication--security)
6. [Rate Limiting Strategy](#rate-limiting-strategy)
7. [API Design](#api-design)
8. [Deployment Architecture](#deployment-architecture)
9. [Monitoring & Logging](#monitoring--logging)

---

## Project Overview

**Rate Limiter API Gateway** is a production-grade Node.js/Express service that manages API keys, rate limiting, and user authentication. It provides:
- User authentication with JWT tokens
- API key management and validation
- Per-route and per-key rate limiting using Redis
- Request logging and usage tracking
- OpenAPI/Swagger documentation
- Sentry error tracking integration

**Tech Stack:**
- **Runtime**: Node.js 22 (TypeScript)
- **Framework**: Express 5
- **Database**: PostgreSQL 16
- **Cache/Sessions**: Redis 7
- **ORM**: Prisma 7
- **Authentication**: JWT + bcryptjs
- **Logging**: Winston
- **Error Tracking**: Sentry
- **Container**: Docker + Docker Compose

---

## Architecture

### System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Applications                          │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Rate Limiter   │
                    │  API Gateway    │
                    │   (Express)     │
                    └────────┬────────┘
                    │
        ┌───────────┼───────────┬──────────────┐
        │           │           │              │
    ┌───▼──┐  ┌────▼───┐  ┌────▼──┐  ┌──────▼────┐
    │Redis │  │Postgres│  │Sentry │  │Swagger    │
    │Cache │  │Database│  │Error  │  │Docs       │
    │      │  │        │  │Track  │  │           │
    └──────┘  └────────┘  └───────┘  └───────────┘
```

### Request Flow
```
Request
  ↓
Request Logger Middleware (capture request ID)
  ↓
Helmet & CORS (Security Headers)
  ↓
Route Matching
  ↓
Authentication (JWT or API Key)
  ↓
Rate Limiter Check (Redis)
  ↓
Controller Logic
  ↓
Database Query (Prisma)
  ↓
Response
  ↓
Error Handler (if error occurs)
```

### Middleware Stack (in app.ts)
```typescript
app.use(helmet())                          // Security headers
app.use(cors())                            // CORS handling
app.use(express.json())                    // JSON parsing
app.use(mountSwagger)                      // Swagger UI
app.use(requestLogger)                     // Request logging
app.use(Sentry context)                    // Error tracking
app.use(routes)                            // API routes
app.use(cacheResponse)                     // Response caching
app.use(errorHandler)                      // Error handling
```

---

## Feature Implementations

### 1. Authentication System

#### JWT Token Generation
**Location**: `services/authService.ts`

```typescript
// User login → Generate JWT token
async function loginUser(email, password) {
  1. Find user by email in database
  2. Verify password with bcryptjs.compare()
  3. Generate JWT token:
     - Payload: { userId, email, iat }
     - Secret: process.env.JWT_SECRET
     - Expiration: process.env.JWT_EXPIRES_IN (default: 1h)
  4. Return token to client
}
```

**How it works:**
- User submits email + password to `/api/v1/auth/login`
- Password is compared against bcrypt hash stored in database
- On success, JWT token is generated and returned
- Token contains user ID and can be used for subsequent requests

**Security Measures:**
- Passwords hashed with bcryptjs (10 salt rounds)
- JWT secret must be 32+ characters in production
- Token expiration enforced
- Claims validated on each protected request

#### Token Verification
**Location**: `middlewares/apiKeyAuth.ts`

```typescript
// Protected route handler
function verifyToken(req) {
  1. Extract token from:
     - Authorization: Bearer <token> header
     - x-api-key header
     - apiKey query parameter (testing only)
  2. Verify token signature with secret
  3. Check expiration
  4. Attach userId to request
}
```

**Middleware Usage:**
```typescript
app.get('/api/v1/protected', apiKeyAuthMiddleware, handler)
```

---

### 2. API Key Management

#### API Key Generation
**Location**: `services/apiKeyService.ts`

```typescript
async function createApiKey(userId, ratePlanId) {
  1. Generate UUID as key
  2. Hash key for storage (bcryptjs)
  3. Store in database:
     - Plain key: returned to user once
     - Hashed key: stored in DB
     - Rate plan: associated for limits
     - User ID: for ownership
  4. Return plain key (never shown again)
}
```

**Key Characteristics:**
- Each API key is unique (UUID format)
- Keys are hashed before storage (security best practice)
- Keys are associated with rate plans (usage limits)
- Can be enabled/disabled without deletion
- Rotatable (create new key, disable old one)

#### API Key Validation
**Location**: `services/apiKeyService.ts`

```typescript
async function validateApiKey(apiKey) {
  1. Hash incoming API key
  2. Search database for matching hash
  3. Check if key is enabled
  4. Check if key is expired (soft delete)
  5. Return userId + apiKeyId for rate limiting
}
```

---

### 3. Rate Limiting System

#### Two-Level Rate Limiting

**Level 1: Global Rate Limiter** (all requests)
**Location**: `middlewares/rateLimiter.ts`

```typescript
// Per-IP rate limiting
// Uses Redis to track request counts
function globalRateLimiter(req) {
  1. Extract client IP (account for proxies)
  2. Create Redis key: "rate:ip:{ip}"
  3. Increment counter for current window
  4. Set expiration (usually 1 minute)
  5. Check if exceeded global limit (e.g., 100 req/min)
  6. Return 429 Too Many Requests if exceeded
}
```

**Level 2: Per-Route Rate Limiter** (API key specific)
**Location**: `middlewares/routeRateLimiter.ts`

```typescript
// Per-API-key rate limiting based on plan
function routeRateLimiter(ratePlan) {
  1. Extract API key ID from request
  2. Create Redis key: "usage:{apiKeyId}:{route}"
  3. Check current usage against plan limits
  4. Plans define:
     - Requests per minute
     - Requests per hour
     - Requests per day
  5. Track in database for billing/analytics
}
```

#### Redis Implementation
**Location**: `utils/redis.ts`

```typescript
// Connection with failover strategy
const redis = new Redis(process.env.REDIS_URL, {
  retryStrategy: exponential backoff,  // Auto-reconnect
  enableOfflineQueue: false,           // Fail fast
  maxRetriesPerRequest: null           // Don't queue when offline
})

// Health check
app.get('/health', () => {
  1. Check Redis connection
  2. Check database connection
  3. Return status (healthy/degraded)
})
```

**Why Redis?**
- Fast in-memory lookups (sub-millisecond)
- Atomic operations for counter increments
- Automatic expiration (TTL)
- Scales horizontally
- Perfect for rate limiting patterns

---

### 4. Database Design

#### Database Schema (Prisma)
**Location**: `prisma/schema.prisma`

```sql
-- Users Table
User {
  id: UUID
  email: String (unique)
  passwordHash: String
  createdAt: DateTime
  updatedAt: DateTime
  apiKeys: [ApiKey]
}

-- API Keys Table
ApiKey {
  id: UUID
  userId: UUID
  keyHash: String (hashed)
  ratePlanId: UUID
  isEnabled: Boolean
  createdAt: DateTime
  expiresAt: DateTime
  user: User
  ratePlan: RatePlan
  requestLogs: [RequestLog]
}

-- Rate Plans Table
RatePlan {
  id: UUID
  name: String (free, pro, enterprise)
  requestsPerMinute: Int
  requestsPerHour: Int
  requestsPerDay: Int
  apiKeys: [ApiKey]
}

-- Request Logs Table (for billing/analytics)
RequestLog {
  id: UUID
  apiKeyId: UUID
  route: String
  method: String
  statusCode: Int
  responseTime: Int (ms)
  createdAt: DateTime
  apiKey: ApiKey
}

-- Usage Tracking Table
Usage {
  id: UUID
  apiKeyId: UUID
  date: DateTime
  requestCount: Int
  apiKey: ApiKey
}
```

#### Database Migrations
**Location**: `prisma/migrations/`

```bash
# Prisma automatically handles migrations
# Each schema change creates a new migration file
prisma migrate dev --name init_db   # Development
prisma migrate deploy               # Production
```

**Migration Features:**
- Version controlled SQL changes
- Automatic rollback capability
- Safe for production
- Supports multiple databases

---

### 5. Request Logging & Tracking

#### Request Logger Middleware
**Location**: `middlewares/requestLogger.ts`

```typescript
function requestLogger(req, res, next) {
  1. Generate unique requestId (UUID)
  2. Attach to request object
  3. Capture start time
  4. Log request details:
     - Method, URL, IP, User Agent
     - Request body (if not sensitive)
  5. Attach to response headers (X-Request-ID)
  6. On response:
     - Calculate response time
     - Log status code
     - Log response size
     - Store in Winston logger
}
```

#### Usage Tracking
**Location**: `services/rateLimitService.ts`

```typescript
async function recordUsage(apiKeyId, route) {
  1. Increment counter in Redis (real-time)
  2. Record in database for:
     - Billing purposes
     - Analytics
     - User dashboards
     - Auditing
}
```

#### Logging Levels
```
ERROR   → Critical issues (database down, auth failure)
WARN    → Warnings (Redis not ready, deprecated API)
INFO    → Standard operations (requests, key creation)
DEBUG   → Detailed troubleshooting (if enabled)
```

---

### 6. Authentication & Security

#### Implemented Security Measures

**1. Helmet Middleware**
```typescript
app.use(helmet())  // Adds security headers:
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection: 1; mode=block
// - Strict-Transport-Security
// - Content-Security-Policy
```

**2. CORS Protection**
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:3000'],
  credentials: true
}))
```

**3. Password Security**
```typescript
// Hash with bcryptjs
const hash = await bcryptjs.hash(password, 10)  // 10 salt rounds
const match = await bcryptjs.compare(password, hash)
```

**4. JWT Tokens**
```typescript
// Signed with secret, includes expiration
const token = jwt.sign(
  { userId, email },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
)
```

**5. API Key Hashing**
```typescript
// Keys also hashed for extra security
const keyHash = await bcryptjs.hash(apiKey, 10)
// Never store plain text keys in database
```

**6. Input Validation (Zod)**
```typescript
// All routes validate input with Zod schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

// Validation happens before controller logic
const validated = loginSchema.parse(req.body)
```

---

### 7. Error Handling

#### Global Error Handler
**Location**: `middlewares/errorHandler.ts`

```typescript
// Centralized error handling
function errorHandler(err, req, res, next) {
  // Different error types:
  
  1. AppError (custom errors)
     → Return specific status code + message
  
  2. ZodError (validation errors)
     → Return 400 with validation details
  
  3. JWT Errors
     → Return 401 unauthorized
  
  4. Unknown Errors
     → Return 500, hide details in production
     → Send to Sentry for tracking
}
```

#### Sentry Integration
```typescript
// Error tracking
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1  // 10% sampling
})

// On error
Sentry.captureException(err)  // Sent to Sentry
```

---

### 8. Caching Strategy

#### Response Caching
**Location**: `middlewares/cache.ts`

```typescript
function cacheResponse({ ttl = 60 }) {
  1. For GET requests:
     - Check Redis cache
     - If hit, return cached response
     - If miss, execute handler
     - Cache response for TTL seconds
  2. For POST/PUT/DELETE:
     - Skip caching
     - Invalidate related cache keys
}
```

#### Use Cases:
- User profile endpoints (60 seconds)
- Rate plan information (300 seconds)
- Health check (not cached)
- Public API documentation (long TTL)

---

### 9. Rate Plans System

#### Plan Structure
```typescript
interface RatePlan {
  id: string
  name: 'free' | 'pro' | 'enterprise'
  requestsPerMinute: number    // 10, 100, unlimited
  requestsPerHour: number      // 1000, 10000, unlimited
  requestsPerDay: number       // 10000, 100000, unlimited
  maxConcurrentRequests: number
  features: string[]           // webhook, analytics, etc.
}
```

#### Checking Rate Limits
```typescript
async function checkRateLimit(apiKeyId, ratePlan) {
  const usage = await getUsageFromRedis(apiKeyId)
  
  if (usage.perMinute > ratePlan.requestsPerMinute) {
    return 429  // Too Many Requests
  }
  if (usage.perHour > ratePlan.requestsPerHour) {
    return 429
  }
  if (usage.perDay > ratePlan.requestsPerDay) {
    return 429
  }
  return 200  // OK
}
```

---

### 10. Graceful Shutdown

#### Server Shutdown Sequence
**Location**: `server.ts`

```typescript
// Listen for termination signals
process.on('SIGTERM', async () => {
  1. Stop accepting new connections
  2. Wait for existing requests to finish (10s timeout)
  3. Close database connection
  4. Close Redis connection
  5. Exit process
})
```

**Why Important:**
- Prevents data corruption
- Completes in-flight requests
- Allows orchestrators (Docker, K8s) to restart gracefully
- Zero-downtime deployments

---

## API Design

### Authentication Routes
```
POST   /api/v1/auth/register      - Register new user
POST   /api/v1/auth/login         - Login, get JWT
POST   /api/v1/auth/refresh       - Refresh token (optional)
```

### API Key Routes
```
POST   /api/v1/api-keys           - Create API key
GET    /api/v1/api-keys           - List user's API keys
GET    /api/v1/api-keys/{id}      - Get API key details
DELETE /api/v1/api-keys/{id}      - Revoke API key
PATCH  /api/v1/api-keys/{id}      - Update API key
```

### Protected Routes
```
GET    /api/v1/protected/profile  - Get user profile
GET    /api/v1/protected/usage    - Get usage stats
```

### Health Check
```
GET    /health                     - Service health status
```

---

## Deployment Architecture

### Docker Deployment

#### Multi-Stage Build Process
```dockerfile
# Stage 1: Builder
FROM node:22-alpine
RUN npm ci --only=production
RUN npx prisma generate

# Stage 2: Runtime
FROM node:22-alpine
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 5050
HEALTHCHECK --interval=30s --timeout=3s --retries=3
CMD ["npm", "start"]
```

**Benefits:**
- Smaller final image (builder dependencies removed)
- Faster deployments
- Better security (no build tools in production)
- Reproducible builds

### Environment Configuration
```bash
# Development
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5433/db
REDIS_URL=redis://localhost:6380
JWT_SECRET=<dev-secret>

# Production
NODE_ENV=production
DATABASE_URL=<managed-database>
REDIS_URL=<managed-redis>
JWT_SECRET=<secure-32-char-secret>
SENTRY_DSN=<error-tracking>
LOG_LEVEL=info
```

### Orchestration Options

**1. Kubernetes (Recommended for scale)**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rate-limiter-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: rate-limiter-api:latest
        ports:
        - containerPort: 5050
        livenessProbe:
          httpGet:
            path: /health
            port: 5050
          initialDelaySeconds: 10
          periodSeconds: 30
```

**2. Docker Compose (Development/Small Scale)**
```yaml
services:
  api:
    build: .
    ports: ["5050:5050"]
    depends_on: [postgres, redis]
  postgres:
    image: postgres:16
  redis:
    image: redis:7
```

**3. Serverless (AWS Lambda, Google Cloud Run)**
- Requires adapting Express to serverless functions
- Less suitable for long-running services
- Better for stateless endpoints

---

## Monitoring & Logging

### Winston Logger Configuration
**Location**: `utils/logger.ts`

```typescript
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new transports.Console(),  // Stdout
    new transports.File({       // File rotation
      filename: 'logs/app.log',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5
    })
  ]
})
```

### Log Output Format
```json
{
  "timestamp": "2024-02-09T10:30:00.000Z",
  "level": "info",
  "message": "User login successful",
  "userId": "uuid",
  "requestId": "uuid",
  "duration": 145
}
```

### Metrics to Monitor

**Performance Metrics:**
- Response time (p50, p95, p99)
- Request throughput (req/sec)
- Error rate (%)
- Database query performance

**Business Metrics:**
- API key usage per plan
- Active users
- Authentication success rate
- Rate limit violations

**Infrastructure Metrics:**
- CPU usage
- Memory usage
- Database connections
- Redis memory
- Disk space

### Alerting Rules

```yaml
- Name: HighErrorRate
  Condition: error_rate > 5%
  Action: PagerDuty notification

- Name: SlowResponse
  Condition: response_time_p99 > 1000ms
  Action: Log & investigate

- Name: RateLimitExceeded
  Condition: 429_responses > 100/min
  Action: Alert engineering team
```

---

## Performance Optimization

### Database Optimization
```typescript
// Indexes (defined in Prisma schema)
@@index([email])
@@index([apiKeyId])
@@index([createdAt])

// Connection pooling (Prisma handles)
// Batch operations where possible
const users = await prisma.user.findMany({
  include: { apiKeys: true }  // Single query with JOIN
})
```

### Redis Optimization
```typescript
// Pipeline operations
const pipeline = redis.pipeline()
pipeline.incr('counter:1')
pipeline.incr('counter:2')
await pipeline.exec()

// Proper TTL to avoid memory bloat
redis.setex('key', 3600, 'value')
```

### Application Optimization
```typescript
// Middleware ordering (fast first)
app.use(helmet)          // Fast
app.use(cors)            // Fast
app.use(express.json)    // Medium
app.use(logging)         // Medium
app.use(auth)            // Medium (DB lookup)
app.use(routes)          // Slow (business logic)

// Async handling
app.use(asyncMiddleware(handler))
```

---

## Security Checklist for Production

- [x] Helmet middleware enabled
- [x] CORS properly configured
- [x] Input validation with Zod
- [x] Password hashing with bcryptjs
- [x] JWT token validation
- [x] API key validation
- [x] SQL injection prevention (Prisma ORM)
- [x] XSS protection (JSON responses only)
- [x] CSRF protection (stateless JWT)
- [x] Rate limiting enabled
- [ ] HTTPS/TLS enforcement (add to reverse proxy)
- [ ] Secrets in environment variables only
- [ ] Database backups configured
- [ ] Access logs maintained
- [ ] Regular security audits scheduled

---

## Troubleshooting Guide

### Issue: 429 Too Many Requests
**Cause**: Rate limit exceeded
**Solution**:
1. Verify rate plan limits
2. Check Redis is running: `redis-cli ping`
3. Clear rate limit counter: `redis-cli DEL rate:ip:{ip}`

### Issue: 401 Unauthorized
**Cause**: Invalid/expired JWT or API key
**Solution**:
1. Verify token expiration: `jwt.decode(token)`
2. Check JWT_SECRET matches across instances
3. Regenerate API key if compromised

### Issue: Database Connection Failed
**Cause**: Connection string error or database down
**Solution**:
1. Verify DATABASE_URL is correct
2. Check database credentials
3. Verify database is running: `pg_isready -h hostname`

### Issue: High Memory Usage
**Cause**: Redis memory bloat or memory leak
**Solution**:
1. Check Redis memory: `redis-cli INFO memory`
2. Verify TTL is set on all keys
3. Monitor application for memory leaks

---

## Conclusion

This API Gateway is built with production-grade patterns:
- Scalable architecture
- Security best practices
- Comprehensive logging
- Error handling
- Graceful degradation
- Observable & maintainable code

Ready for deployment to any cloud platform with proper CI/CD pipelines and secrets management.
