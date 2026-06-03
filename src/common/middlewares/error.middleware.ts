import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { BaseError } from '../exceptions/base.error';
import { ValidationError, InfrastructureError } from '../exceptions/errors';
import { sendError } from '../utils/response.util';
import { logger } from '../utils/logger';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof BaseError) {
    sendError(res, err.message, err.statusCode, err.errors, err.code);
    return;
  }

  if (err instanceof ZodError) {
    const validationErr = new ValidationError(
      'Validation failed',
      err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    );
    sendError(res, validationErr.message, validationErr.statusCode, validationErr.errors);
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  const infra = new InfrastructureError('Internal server error');
  sendError(res, infra.message, infra.statusCode, undefined, infra.code);
}
