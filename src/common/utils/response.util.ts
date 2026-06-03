import { Response } from 'express';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Array<{ field?: string; message: string }>;
  code?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: Record<string, unknown>,
): void {
  const body: ApiSuccessResponse<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number,
  errors?: Array<{ field?: string; message: string }>,
  code?: string,
): void {
  const body: ApiErrorResponse = { success: false, message };
  if (errors) body.errors = errors;
  if (code) body.code = code;
  res.status(statusCode).json(body);
}
