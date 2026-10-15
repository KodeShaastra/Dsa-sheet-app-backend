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

/** cookie-parser types req.cookies as `any`, so read it as unknown and narrow. */
function readAuthCookie(cookies: unknown): string | null {
  if (typeof cookies !== 'object' || cookies === null) return null;
  const token: unknown = (cookies as Record<string, unknown>)[env.COOKIE_NAME];
  return typeof token === 'string' ? token : null;
}

/** Reads the JWT from the auth cookie and sets req.user, or responds 401. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readAuthCookie(req.cookies);
  const userId = token ? verifyToken(token) : null;

  if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Not logged in');

  req.user = { id: userId };
  next();
};
