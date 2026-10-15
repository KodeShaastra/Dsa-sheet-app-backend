import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';

const payloadSchema = z.object({ sub: z.string() });

/** Signs a token with payload { sub: userId }. */
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>,
    algorithm: 'HS256',
  });
}

/** Returns the user id, or null if the token is missing, invalid, or expired. */
export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const result = payloadSchema.safeParse(decoded);
    return result.success ? result.data.sub : null;
  } catch {
    return null;
  }
}
