import { ApiErrorDetail } from '../../../shared/types/index.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(
    message = 'Malformed syntax or invalid request format.',
    details?: ApiErrorDetail[],
    code = 'BAD_REQUEST'
  ) {
    super(400, code, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = 'Authentication required or token is invalid.',
    code = 'UNAUTHORIZED'
  ) {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = 'You do not have permission to perform this action.',
    code = 'FORBIDDEN'
  ) {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = 'The requested resource was not found.',
    code = 'NOT_FOUND'
  ) {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = 'Resource conflict or duplicate record.',
    details?: ApiErrorDetail[],
    code = 'CONFLICT'
  ) {
    super(409, code, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = 'Invalid request data or semantic validation failed.',
    details?: ApiErrorDetail[]
  ) {
    super(422, 'VALIDATION_FAILED', message, details);
  }
}

