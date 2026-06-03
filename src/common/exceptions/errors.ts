import { BaseError } from './base.error';

export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class AuthenticationError extends BaseError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_ERROR';
}

export class AuthorizationError extends BaseError {
  readonly statusCode = 403;
  readonly code = 'AUTHORIZATION_ERROR';
}

export class DomainError extends BaseError {
  readonly statusCode = 422;
  readonly code = 'DOMAIN_ERROR';
}

export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

export class InfrastructureError extends BaseError {
  readonly statusCode = 500;
  readonly code = 'INFRASTRUCTURE_ERROR';
  readonly isOperational = false;
}
