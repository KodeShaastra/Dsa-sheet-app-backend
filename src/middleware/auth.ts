import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

export interface AuthUser {
  id: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Reads the JWT from the auth cookie and sets req.user, or responds 401. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token: unknown = req.cookies?.[env.COOKIE_NAME];
  const userId = typeof token === 'string' ? verifyToken(token) : null;

  if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Not logged in');

  req.user = { id: userId };
  next();
};
