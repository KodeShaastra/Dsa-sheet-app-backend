import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError, zodDetails } from '../utils/AppError.js';

type Source = 'body' | 'query' | 'params';

/**
 * Checks req[source] against a Zod schema. On success, replaces it with the
 * parsed (cleaned) value. On failure, responds 400 VALIDATION_ERROR.
 *
 *   router.post('/login', validate('body', loginSchema), controller.login)
 */
export function validate(source: Source, schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(result.error));
    }
    // Express 5 makes req.query read-only, so redefine it instead of assigning.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    next();
  };
}
