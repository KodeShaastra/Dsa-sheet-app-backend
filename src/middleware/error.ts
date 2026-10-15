import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { logger } from '../lib/logger.js';
import { AppError, zodDetails } from '../utils/AppError.js';

export const notFound: RequestHandler = (req) => {
  throw new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`);
};

/** Errors from express.json(): bad JSON, body too large, wrong encoding. All are 4xx. */
function isBodyParserError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  );
}

/** Turns any thrown value into an AppError. Unknown errors become 500 INTERNAL. */
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  // In case a service calls schema.parse() directly.
  if (err instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(err));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return new AppError(409, 'CONFLICT', 'Already exists');
    if (err.code === 'P2025') return new AppError(404, 'NOT_FOUND', 'Not found');
  }

  if (isBodyParserError(err)) {
    return new AppError(400, 'VALIDATION_ERROR', 'Invalid request body');
  }

  logger.error({ err }, 'Unhandled error');
  return new AppError(500, 'INTERNAL', 'Internal server error');
}

/** The only place that writes error responses. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const { status, code, message, details } = toAppError(err);
  res.status(status).json({ error: { code, message, details } });
};
