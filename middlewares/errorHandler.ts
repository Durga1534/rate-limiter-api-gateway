import express from 'express';
import { AppError, ErrorCode } from '../utils/errors.ts';
import { createErrorResponse } from '../utils/response.ts';
import * as Sentry from '@sentry/node';
import logger from '../utils/logger.ts';

/**
 * Enhanced error handler with structured logging and graceful degradation
 * Provides consistent error responses and detailed logging for debugging
 */
export function errorHandler(
  err: Error | AppError,
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';
  const method = req.method;
  const path = req.path;

  // Don't log health checks (noisy)
  const isHealthCheck = path === '/health';

  // Extract error details for logging
  const errorDetails = {
    requestId,
    method,
    path,
    name: err.name,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  };

  // Send to Sentry if initialized (for production)
  try {
    if (process.env.SENTRY_DSN && Sentry && typeof Sentry.captureException === 'function') {
      Sentry.captureException(err, {
        tags: {
          requestId,
          method,
          path,
        },
      });
    }
  } catch (sentryErr) {
    if (!isHealthCheck) {
      logger.warn('Failed to send error to Sentry', { error: sentryErr });
    }
  }

  // Handle AppError (custom errors we throw)
  if (err instanceof AppError) {
    if (!isHealthCheck) {
      logger.info(`AppError: ${err.code}`, {
        ...errorDetails,
        code: err.code,
        statusCode: err.statusCode,
      });
    }

    const response = createErrorResponse(err.code, err.message, err.details);
    return res.status(err.statusCode).json(response);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const validationErrors = (err as any).errors.reduce(
      (acc: any, e: any) => ({
        ...acc,
        [e.path.join('.')]: e.message,
      }),
      {}
    );

    if (!isHealthCheck) {
      logger.warn('Validation error', {
        ...errorDetails,
        code: ErrorCode.VALIDATION_ERROR,
        validationErrors,
      });
    }

    const response = createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
      validationErrors
    );
    return res.status(400).json(response);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    if (!isHealthCheck) {
      logger.warn('JWT validation error', {
        ...errorDetails,
        code: ErrorCode.UNAUTHORIZED,
      });
    }

    const response = createErrorResponse(
      ErrorCode.UNAUTHORIZED,
      'Invalid or expired token'
    );
    return res.status(401).json(response);
  }

  if (err.name === 'TokenExpiredError') {
    if (!isHealthCheck) {
      logger.warn('Token expired', {
        ...errorDetails,
        code: ErrorCode.UNAUTHORIZED,
      });
    }

    const response = createErrorResponse(
      ErrorCode.UNAUTHORIZED,
      'Token has expired'
    );
    return res.status(401).json(response);
  }

  // Handle database/prisma errors
  if ((err as any).code === 'P2025') {
    // Prisma "not found" error
    const response = createErrorResponse(
      ErrorCode.NOT_FOUND,
      'Resource not found'
    );
    return res.status(404).json(response);
  }

  if ((err as any).code === 'P2002') {
    // Prisma unique constraint error
    const field = (err as any).meta?.target?.[0] || 'field';
    const response = createErrorResponse(
      ErrorCode.CONFLICT,
      `${field} already exists`
    );
    return res.status(409).json(response);
  }

  // Handle general database errors
  if ((err as any).code?.startsWith('P')) {
    if (!isHealthCheck) {
      logger.error('Database error', {
        ...errorDetails,
        prismaCode: (err as any).code,
      });
    }

    const response = createErrorResponse(
      ErrorCode.INTERNAL_SERVER_ERROR,
      process.env.NODE_ENV === 'production'
        ? 'Database operation failed'
        : err.message
    );
    return res.status(500).json(response);
  }

  // Generic/unhandled error
  if (!isHealthCheck) {
    logger.error('Unhandled error', {
      ...errorDetails,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    });
  }

  const response = createErrorResponse(
    ErrorCode.INTERNAL_SERVER_ERROR,
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  );
  return res.status(500).json(response);
}

/**
 * Wraps async route handlers to catch errors
 * Usage: router.get('/path', asyncHandler(async (req, res) => {...}))
 */
export function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      next(err);
    });
  };
}

/**
 * Middleware wrapper for async middleware
 * Similar to asyncHandler but for middleware functions
 */
export function asyncMiddleware(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      next(err);
    });
  };
}
