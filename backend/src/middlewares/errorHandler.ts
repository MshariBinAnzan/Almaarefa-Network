import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { ApiErrorResponse } from '../../../shared/types/index.js';
import { env } from '../config/env.js';

export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} does not exist.`,
    },
  };
  return res.status(404).json(response);
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && err.details.length > 0
          ? { details: err.details }
          : {}),
      },
    };
    return res.status(err.statusCode).json(response);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.') || 'request',
      issue: issue.message,
    }));
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: details[0]?.issue || 'Request validation failed.',
        details,
      },
    };
    return res.status(422).json(response);
  }

  // Malformed JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON in request body.',
      },
    };
    return res.status(400).json(response);
  }

  // PostgreSQL error codes
  if (err && typeof err.code === 'string') {
    // Unique constraint violation
    if (err.code === '23505') {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A record with the provided unique value already exists.',
        },
      };
      return res.status(409).json(response);
    }

    // Foreign key constraint violation
    if (err.code === '23503') {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Referenced resource does not exist.',
        },
      };
      return res.status(422).json(response);
    }

    // Invalid UUID / text representation
    if (err.code === '22P02') {
      const response: ApiErrorResponse = {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid UUID format provided.',
        },
      };
      return res.status(400).json(response);
    }
  }

  if (env.nodeEnv !== 'test') {
    console.error('[Unhandled Backend Error]:', err);
  }

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred.',
    },
  };
  return res.status(500).json(response);
}

