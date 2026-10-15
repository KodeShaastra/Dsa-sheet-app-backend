import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { signAccessToken } from '../../utils/jwt.js';
import type { LoginInput, SignupInput } from './auth.schema.js';
import {
  issueRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
} from './refreshTokens.service.js';

const BCRYPT_COST = 12;

// Compared against when the email doesn't exist, so a wrong email takes as long
// as a wrong password and the response time doesn't reveal which one it was.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);

// Never send passwordHash back to the client.
const publicUser = { id: true, name: true, email: true } as const;

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, 'CONFLICT', 'Email is already registered');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  return prisma.user.create({
    data: { email: input.email, name: input.name, passwordHash },
    select: publicUser,
  });
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  return { id: user.id, name: user.name, email: user.email };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUser });
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Not logged in');
  return user;
}

export interface SessionTokens {
  accessToken: string;
  /** null when the browser already has the newest refresh cookie (two-tab grace case). */
  refreshToken: string | null;
}

/** After signup/login: a new access token and a new refresh token chain. */
export async function startSession(
  userId: string,
  userAgent: string | null,
): Promise<SessionTokens> {
  return {
    accessToken: signAccessToken(userId),
    refreshToken: await issueRefreshToken(userId, userAgent),
  };
}

/** Swaps a refresh token for fresh tokens. Missing, expired, or reused → 401. */
export async function refreshSession(rawRefreshToken: string | null, userAgent: string | null) {
  if (!rawRefreshToken) throw new AppError(401, 'UNAUTHORIZED', 'Not logged in');

  const result = await rotateRefreshToken(rawRefreshToken, userAgent);
  const user = await getUser(result.userId);
  const tokens: SessionTokens = {
    accessToken: signAccessToken(user.id),
    refreshToken: result.kind === 'rotated' ? result.refreshToken : null,
  };
  return { user, tokens };
}

/** Logout on this device. Works even without a valid access token. */
export async function endSession(rawRefreshToken: string | null): Promise<void> {
  if (rawRefreshToken) await revokeRefreshToken(rawRefreshToken);
}

/** Logout on every device. */
export async function endAllSessions(userId: string): Promise<void> {
  await revokeAllRefreshTokens(userId);
}
