/**
 * Throw this from any route, controller, or service to send a clean error response:
 * `{ error: { code, message, details? } }`
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
