import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError, z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/AppError.js';

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  res.status(status).json({ error: { code, message, ...(details !== undefined && { details }) } });
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
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request', z.flattenError(err).fieldErrors);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    sendError(res, 409, 'CONFLICT', 'Already exists');
    return;
  }

  // Bad JSON body and similar errors from express.json()
  if (typeof err === 'object' && err !== null && 'status' in err && err.status === 400) {
    sendError(res, 400, 'BAD_REQUEST', 'Invalid request body');
    return;
  }

  logger.error({ err }, 'Unhandled error');
  sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
};
