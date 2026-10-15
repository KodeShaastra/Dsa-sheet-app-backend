import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';

const payloadSchema = z.object({ sub: z.string() });

/** Signs a short-lived access token with payload { sub: userId }. */
export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: Math.floor(env.ACCESS_TOKEN_TTL / 1000),
    algorithm: 'HS256',
  });
}

/** Returns the user id, or null if the token is invalid or expired. */
export function verifyAccessToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const result = payloadSchema.safeParse(decoded);
    return result.success ? result.data.sub : null;
  } catch {
    return null;
  }
}
