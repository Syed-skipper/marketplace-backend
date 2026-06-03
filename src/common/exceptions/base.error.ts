export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly isOperational: boolean = true;

  constructor(
    message: string,
    public readonly errors?: Array<{ field?: string; message: string }>,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false as const,
      message: this.message,
      errors: this.errors,
      code: this.code,
    };
  }
}
