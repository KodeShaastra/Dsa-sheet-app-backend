import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

type Source = 'body' | 'query' | 'params';

/**
 * Checks req[source] against a Zod schema. On success, replaces it with the
 * parsed (cleaned) value. On failure, responds 400 with field errors.
 *
 *   router.post('/login', validate('body', loginSchema), controller.login)
 */
export function validate(source: Source, schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid request',
        z.flattenError(result.error).fieldErrors,
      );
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
