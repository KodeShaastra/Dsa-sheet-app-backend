import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { logger } from '../lib/logger.js';
import { AppError, zodDetails, type ErrorCode, type ErrorDetail } from '../utils/AppError.js';

function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details: ErrorDetail[] = [],
) {
  res.status(status).json({ error: { code, message, details } });
}

export const notFound: RequestHandler = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }

  // In case a service calls schema.parse() directly.
  if (err instanceof ZodError) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(err));
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      sendError(res, 409, 'CONFLICT', 'Already exists');
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Not found');
      return;
    }
  }

  // Bad JSON, body too large, and similar errors from express.json()
  if (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  ) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request body');
    return;
  }

  logger.error({ err }, 'Unhandled error');
  sendError(res, 500, 'INTERNAL', 'Internal server error');
};
