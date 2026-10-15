import type { ZodError } from 'zod';

/** The only error codes the API sends. */
export type ErrorCode =
  | 'VALIDATION_ERROR' // 400
  | 'UNAUTHORIZED' // 401
  | 'FORBIDDEN' // 403
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409
  | 'RATE_LIMITED' // 429
  | 'INTERNAL'; // 500

export interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * Throw this from any route, controller, or service to send a clean error response:
 * `{ error: { code, message, details } }`
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Turns Zod issues into `[{ path: "email", message: "Invalid email address" }]`. */
export function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}
