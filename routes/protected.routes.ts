import express from 'express';
import { asyncMiddleware } from '../middlewares/errorHandler.ts';
import { apiKeyAuthMiddleware } from '../middlewares/apiKeyAuth.ts';
import { apiKeyRateLimitMiddleware } from '../middlewares/rateLimiter.ts';
import { createRouteRateLimiter, defaultRouteLimits } from '../middlewares/routeRateLimiter.ts';
import { logRequest, getUsageStats } from '../services/rateLimitService.ts';
import { createSuccessResponse } from '../utils/response.ts';

const router = express.Router();

// Apply API key authentication and rate limiting to all routes
router.use(asyncMiddleware(apiKeyAuthMiddleware));
router.use(apiKeyRateLimitMiddleware);
router.use(createRouteRateLimiter(defaultRouteLimits));

router.post('/ping', asyncMiddleware(async (req: express.Request, res: express.Response): Promise<void> => {
  const apiKeyId = (req as any).apiKeyId;
  const startTime = Date.now();

  // Log the request
  await logRequest(
    apiKeyId,
    '/api/v1/ping',
    200,
    Date.now() - startTime,
    req.ip
  );

  res.status(200).json(
    createSuccessResponse(
      {
        message: 'Pong! Your API key is valid.',
        timestamp: new Date().toISOString(),
        headers: {
          'X-RateLimit-Limit': res.getHeader('X-RateLimit-Limit'),
          'X-RateLimit-Remaining': res.getHeader('X-RateLimit-Remaining'),
          'X-RateLimit-Reset': res.getHeader('X-RateLimit-Reset'),
        },
      },
      'API key authenticated successfully'
    )
  );
}));

/**
 * GET /api/v1/ping
 * GET version of the ping endpoint
 */
router.get('/ping', asyncMiddleware(async (req: express.Request, res: express.Response): Promise<void> => {
  const apiKeyId = (req as any).apiKeyId;
  const startTime = Date.now();

  // Log the request
  await logRequest(
    apiKeyId,
    '/api/v1/ping',
    200,
    Date.now() - startTime,
    req.ip
  );

  res.status(200).json(
    createSuccessResponse(
      {
        message: 'Pong! Your API key is valid.',
        timestamp: new Date().toISOString(),
        headers: {
          'X-RateLimit-Limit': res.getHeader('X-RateLimit-Limit'),
          'X-RateLimit-Remaining': res.getHeader('X-RateLimit-Remaining'),
          'X-RateLimit-Reset': res.getHeader('X-RateLimit-Reset'),
        },
      },
      'API key authenticated successfully'
    )
  );
}));

/**
 * GET /api/v1/ping/stats
 * View usage statistics for your API key
 */
router.get('/ping/stats', asyncMiddleware(async (req: express.Request, res: express.Response): Promise<void> => {
  const apiKeyId = (req as any).apiKeyId;
  const startTime = Date.now();

  const stats = await getUsageStats(apiKeyId);

  // Log the request
  await logRequest(
    apiKeyId,
    '/api/v1/ping/stats',
    200,
    Date.now() - startTime,
    req.ip
  );

  res.status(200).json(
    createSuccessResponse(stats, 'Usage statistics retrieved successfully')
  );
}));

export default router;
