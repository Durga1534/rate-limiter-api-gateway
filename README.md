# 🚦 Rate Limiting API Gateway

A backend API gateway with JWT authentication, dynamic API key management, and **distributed sliding-window rate limiting** enforced across Redis, PostgreSQL, and in-memory layers — built with Express, TypeScript, and Prisma.

[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-black.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-336791.svg)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D.svg)](https://upstash.com/)
[![Tests](https://img.shields.io/badge/tests-jest-C21325.svg)](https://jestjs.io/)

## Table of Contents

- [Why This Project Exists](#why-this-project-exists)
- [From Fixed Window to Sliding Window](#from-fixed-window-to-sliding-window)
- [Rate Limiting Architecture](#rate-limiting-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Routes](#api-routes)
- [Resilience](#resilience)
- [Testing](#testing)
- [Scripts](#scripts)
- [Author](#author)

---

## Why This Project Exists

Most rate limiter tutorials use a single in-memory counter that resets at a fixed clock boundary. That breaks in two common ways: it doesn't survive across multiple server instances, and it lets a client burst through the limit by timing requests around the window edge — for example, sending the full quota right before a minute ticks over, then the full quota again right after.

This gateway addresses both problems: Redis makes the counter shared across instances, and a sliding-window-counter algorithm removes the boundary-burst gap by blending a time-weighted portion of the previous window into every check.

---

## From Fixed Window to Sliding Window

The first version of this rate limiter used a fixed window: requests were counted in buckets aligned to clock boundaries (`Math.floor(now / windowMs) * windowMs`), and the counter reset hard at each boundary. That's simple and fast, but it has a known weakness — a client can send a full burst at `59.9s` and another full burst at `60.1s`, doubling the effective limit within a 200ms span, because the two bursts land in different buckets.

The current version replaces this with a **sliding-window counter**: each check reads both the current bucket and the previous bucket, then estimates actual usage as

```
estimated = countCurrent + countPrevious × (1 − elapsedFractionOfCurrentWindow)
```

A request right after a bucket boundary still gets charged for most of the previous bucket's usage, which closes the burst gap without the cost of storing a full sliding log of every request timestamp (the more expensive alternative). This same pattern is applied consistently in three places:

| Layer | File | Backing Store |
|---|---|---|
| Global / per-route Redis limiter | `middlewares/rateLimiter.ts` | Redis (`ioredis`, pipelined `GET`s) |
| Per-plan API key limiter | `services/rateLimitService.ts` | PostgreSQL (Prisma) |
| Route-specific limiter | `middlewares/routeRateLimiter.ts` | In-process `Map` |

---

## Rate Limiting Architecture

Three independent layers enforce limits at different scopes, each using the sliding-window approach above:

**Redis-backed global limiter** — applied per IP or per API key, using Redis pipelines (`GET` current + previous bucket, then `INCRBY` + `EXPIRE`) so checks are atomic and safe across multiple server instances. Supports weighted requests, so an expensive endpoint can cost more than 1 unit per call.

**Database per-plan limiter** — each API key belongs to a plan with separate minute/hour/day limits. PostgreSQL is the source of truth here since plan limits need to survive restarts and be queryable for billing/usage reporting, not just enforced in the hot path.

**In-memory route limiter** — route-specific overrides (e.g. a stricter limit on `/upload` than on `/ping`) matched by regex pattern, backed by a local `Map` with periodic cleanup. This layer trades cross-instance consistency for near-zero latency, since route-specific limits are a secondary check layered on top of the Redis/DB limits, not the only line of defense.

Every check sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers; exceeded limits also set `Retry-After`.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js, TypeScript | Type safety across the request pipeline |
| Web framework | Express 5 | Middleware-first request handling |
| Database | PostgreSQL + Prisma | Relational plan/usage data, migrations |
| Cache / limiter store | Redis (Upstash, via `ioredis`) | Shared counters across instances |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` | Stateless session auth, hashed credentials |
| Observability | Winston (structured JSON logs) + Sentry | Local/file logging plus error tracking |
| Docs | `swagger-ui-express` + OpenAPI spec | Live API docs at `/docs` |
| Security | Helmet, CORS | Standard HTTP hardening |
| Testing | Jest | Unit tests for limiter and health logic |

---

## Project Structure

```
rate-limiter-api-gateway/
├── controllers/        # authController, apiKeyController
├── middlewares/
│   ├── rateLimiter.ts        # Redis sliding-window limiter (global + API key)
│   ├── routeRateLimiter.ts   # In-memory sliding-window limiter (per-route)
│   ├── apiKeyAuth.ts         # JWT + API key auth middleware
│   ├── cache.ts
│   ├── errorHandler.ts
│   ├── requestLogger.ts
│   └── swagger.ts
├── routes/              # auth, apiKey, protected, health
├── services/            # authService, apiKeyService, rateLimitService
├── utils/                # logger (Winston), env (Zod-validated), redis, errors
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
├── docs/openapi.yaml
├── Dockerfile
└── docker-compose.yml
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL instance (local or hosted)
- An Upstash Redis instance (REST API, not a raw connection string)

### Docker

```bash
git clone https://github.com/Durga1534/rate-limiter-api-gateway.git
cd rate-limiter-api-gateway
docker-compose up --build
```

### Manual setup

```bash
npm install
cp .env.example .env   # fill in the variables below
npx prisma migrate dev
npx prisma generate
npm run dev
```

---

## Environment Variables

```env
# Application
NODE_ENV=development
PORT=5050

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gateway_db

# Redis (Upstash REST API)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
REDIS_HEALTH_CHECK_INTERVAL=30

# JWT
JWT_SECRET=at_least_32_characters_long_secret
JWT_EXPIRES_IN=7d

# Sentry (optional)
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1

# CORS / Logging
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
```

All variables are validated at startup with a Zod schema (`utils/env.ts`) — the process exits immediately with a clear error if something required is missing, rather than failing later with an unrelated error.

---

## API Routes

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/register` | None | IP-limited (auth limiter) |
| POST | `/api/v1/auth/login` | None | IP-limited (auth limiter) |
| POST | `/api/v1/api-keys` | JWT | Create an API key |
| GET | `/api/v1/api-keys` | JWT | List your API keys |
| POST | `/api/v1/api-keys/:keyId/revoke` | JWT | Revoke a key |
| POST | `/api/v1/api-keys/:keyId/regenerate` | JWT | Rotate a key |
| DELETE | `/api/v1/api-keys/:keyId` | JWT | Delete a key permanently |
| GET / POST | `/api/v1/ping` | API key | Sliding-window limited (global + route) |
| GET | `/api/v1/ping/stats` | API key | Usage stats for the authenticated key |
| GET | `/health` | None | Redis connectivity + uptime |
| GET | `/docs` | None | Swagger UI |

---

## Resilience

| Failure | Behavior |
|---|---|
| Redis unreachable | Health check reports it (`/health`); limiter calls will throw rather than silently allow unlimited traffic — failing closed on the hot path |
| Invalid payload | Rejected by Zod validation before reaching a controller |
| Missing/expired JWT | `401` from auth middleware before any route logic runs |
| Sentry DSN not set | Sentry initialization is skipped; app still runs normally |

---

## Testing

```bash
npm test
```

Current suite covers the health endpoint and basic app wiring (`tests/basic.test.ts`, `tests/lightweight-health.test.ts`). The sliding-window math itself doesn't have a dedicated boundary test yet — that's a known gap, not an oversight being hidden: the next addition planned is a test that simulates a burst split across a bucket boundary and asserts it gets throttled correctly under the sliding-window estimate, which is the actual scenario the fixed-window version got wrong.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run locally with live reload |
| `npm run build` | Compile TypeScript to `/dist` |
| `npm test` | Run Jest suite |
| `npm run lint` | Run ESLint |

---

## Author

**Konduru Durga Prasad** — Backend-focused Full Stack Engineer, Bangalore, India

[GitHub](https://github.com/Durga1534) · [LinkedIn](https://www.linkedin.com/in/durga-prasad-konduru) · kondurudurgaprasad.2@gmail.com
