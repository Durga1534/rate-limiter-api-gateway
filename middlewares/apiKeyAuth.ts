import express from 'express';
import { validateApiKey } from '../services/apiKeyService.ts';
import { AuthenticationError } from '../utils/errors.ts';
import { verifyAccessToken } from '../utils/authHelper.ts';


function extractApiKey(req: express.Request): string | null {
  // Check x-api-key header
  const headerKey = req.headers['x-api-key'] as string;
  if (headerKey) {
    return headerKey;
  }

  // Check Authorization Bearer token
  const authHeader = req.headers.authorization as string;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query parameter (optional, for testing)
  const queryKey = req.query.apiKey as string;
  if (queryKey) {
    return queryKey;
  }

  return null;
}

export async function apiKeyAuthMiddleware(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      throw new AuthenticationError('API key is required (use x-api-key header or Authorization: Bearer <key>)');
    }

    const userId = await validateApiKey(apiKey);

    if (!userId) {
      throw new AuthenticationError('Invalid or revoked API key');
    }

    // Attach userId to request for use in controllers
    (req as any).userId = userId;
    (req as any).apiKey = apiKey;

    next();
  } catch (error) {
    throw error;
  }
}

export async function optionalApiKeyAuthMiddleware(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const apiKey = extractApiKey(req);

  if (apiKey) {
    const userId = await validateApiKey(apiKey);
    if (userId) {
      (req as any).userId = userId;
      (req as any).apiKey = apiKey;
    }
  }

  next();
}

/**
 * Middleware for JWT token validation (for user authentication)
 */
export async function jwtAuthMiddleware(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('JWT token is required');
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    (req as any).userId = payload.userId;
    (req as any).token = token;

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Invalid or expired JWT token');
  }
}
