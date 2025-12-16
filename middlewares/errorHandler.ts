import express from 'express';
import { AppError, ErrorCode } from '../utils/errors.ts';
import { createErrorResponse } from '../utils/response.ts';
import * as Sentry from '@sentry/node';

export function errorHandler(
  err: Error | AppError,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
): void {
  console.error('[Error]', err);

  // Send to Sentry if initialized
  try {
    if (process.env.SENTRY_DSN && Sentry && typeof Sentry.captureException === 'function') {
      Sentry.captureException(err);
    }
  } catch (e) {
    // ignore
  }

  if (err instanceof AppError) {
    const response = createErrorResponse(err.code, err.message, err.details);
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const response = createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
      (err as any).errors
    );
    res.status(400).json(response);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    const response = createErrorResponse(
      ErrorCode.UNAUTHORIZED,
      'Invalid or expired token'
    );
    res.status(401).json(response);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    const response = createErrorResponse(
      ErrorCode.UNAUTHORIZED,
      'Token has expired'
    );
    res.status(401).json(response);
    return;
  }

  // Generic error handler
  const response = createErrorResponse(
    ErrorCode.INTERNAL_SERVER_ERROR,
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  );
  res.status(500).json(response);
}

export function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware wrapper for async middleware
 */
export function asyncMiddleware(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
