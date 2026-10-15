import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/AppError.js';
import * as controller from './auth.controller.js';
import { loginSchema, signupSchema } from './auth.schema.js';

// 5 requests per minute per IP. Each route gets its own counter.
function authLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
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
  const limit = () => (options.rateLimit ? [authLimiter()] : []);

  router.post('/signup', ...limit(), validate('body', signupSchema), controller.signup);
  router.post('/login', ...limit(), validate('body', loginSchema), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth, controller.me);

  return router;
}
