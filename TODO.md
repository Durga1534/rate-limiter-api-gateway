# TODO: Sliding window rate limiting

## Status
- [x] Update Redis middleware sliding-window algorithm in `middlewares/rateLimiter.ts` (two-bucket weighted).
- [x] Update DB-based per-plan limiter sliding-window estimation in `services/rateLimitService.ts` (two-bucket weighted approximation).
- [x] Update route-specific in-memory limiter in `middlewares/routeRateLimiter.ts` (two-bucket weighted approximation).

## Followup steps
- [ ] Re-run tests (`npm test`) to confirm everything passes.

