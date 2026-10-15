import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/AppError.js';
import * as controller from './auth.controller.js';
import { loginSchema, signupSchema } from './auth.schema.js';

/** `limit` requests per minute per IP. Each route gets its own counter. */
function perMinuteLimiter(limit: number) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts, please try again later'));
    },
  });
}

/** Built per app, so each app (and each test) starts with fresh rate-limit counters. */
export function createAuthRouter(options: { rateLimit: boolean }) {
  const router = Router();
  const limit = (perMinute: number) => (options.rateLimit ? [perMinuteLimiter(perMinute)] : []);

  router.post('/signup', ...limit(5), validate('body', signupSchema), controller.signup);
  router.post('/login', ...limit(5), validate('body', loginSchema), controller.login);
  router.post('/refresh', ...limit(30), controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', requireAuth, controller.logoutAll);
  router.get('/me', requireAuth, controller.me);

  return router;
}
