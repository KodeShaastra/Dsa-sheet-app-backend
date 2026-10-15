import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Two tabs can refresh at the same moment with the same token. The first one rotates it; the
 * second arrives with a token that was revoked a moment ago. Within this window that's treated as
 * a normal race (the browser already has the new refresh cookie), not as theft.
 */
export const REUSE_GRACE_MS = 30 * 1000;

type Db = Prisma.TransactionClient | typeof prisma;

interface StoredToken {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export type RotateResult =
  { kind: 'rotated'; userId: string; refreshToken: string } | { kind: 'grace'; userId: string };

/** Thrown inside the rotate transaction when another request rotated the token first. */
class LostRotationRace extends Error {}

const sessionExpired = () =>
  new AppError(401, 'UNAUTHORIZED', 'Session expired, please log in again');

/** SHA-256 hex of the raw token. Only the hash is stored. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Creates and stores a new refresh token. Returns its id and the raw token (for the cookie). */
async function createToken(
  db: Db,
  userId: string,
  familyId: string,
  userAgent: string | null,
): Promise<{ id: string; raw: string }> {
  const raw = randomBytes(64).toString('base64url');
  const { id } = await db.refreshToken.create({
    data: {
      userId,
      familyId,
      userAgent,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
    },
    select: { id: true },
  });
  return { id, raw };
}

/** Starts a new login chain (new familyId). Returns the raw refresh token. */
export async function issueRefreshToken(userId: string, userAgent: string | null): Promise<string> {
  const { raw } = await createToken(prisma, userId, randomUUID(), userAgent);
  return raw;
}

async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** True if this revoked token was rotated moments ago and its replacement is still alive. */
async function isGraceReuse(token: StoredToken): Promise<boolean> {
  if (!token.revokedAt || !token.replacedById) return false;
  if (Date.now() - token.revokedAt.getTime() > REUSE_GRACE_MS) return false;

  const replacement = await prisma.refreshToken.findUnique({ where: { id: token.replacedById } });
  return !!replacement && !replacement.revokedAt && replacement.expiresAt.getTime() > Date.now();
}

/** A revoked token came back: either the two-tab race, or a stolen token. */
async function handleRevokedToken(token: StoredToken): Promise<RotateResult> {
  if (await isGraceReuse(token)) return { kind: 'grace', userId: token.userId };

  logger.warn(
    { userId: token.userId, familyId: token.familyId },
    'Refresh token reuse detected; revoking the whole family',
  );
  await revokeFamily(token.familyId);
  throw sessionExpired();
}

/** In one transaction: create the next token, then revoke this one (only if still active). */
async function rotate(token: StoredToken, userAgent: string | null): Promise<RotateResult> {
  return prisma.$transaction(async (tx) => {
    const next = await createToken(tx, token.userId, token.familyId, userAgent);
    const { count } = await tx.refreshToken.updateMany({
      where: { id: token.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedById: next.id },
    });
    if (count === 0) throw new LostRotationRace(); // rolls back `next`
    return { kind: 'rotated' as const, userId: token.userId, refreshToken: next.raw };
  });
}

/**
 * Swaps a refresh token for a new one.
 * Unknown or expired → 401. Already used → grace (two tabs) or theft (whole family revoked, 401).
 */
export async function rotateRefreshToken(
  raw: string,
  userAgent: string | null,
): Promise<RotateResult> {
  const token = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token || token.expiresAt.getTime() <= Date.now()) throw sessionExpired();
  if (token.revokedAt) return handleRevokedToken(token);

  try {
    return await rotate(token, userAgent);
  } catch (err) {
    if (!(err instanceof LostRotationRace)) throw err;
    const latest = await prisma.refreshToken.findUniqueOrThrow({ where: { id: token.id } });
    return handleRevokedToken(latest);
  }
}

/** Logout: revoke this one token. Unknown tokens are ignored. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Logout everywhere: revoke every active token this user has. */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Deletes tokens that expired or were revoked more than REFRESH_TOKEN_TTL_DAYS ago. */
export async function deleteOldRefreshTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
  const { count } = await prisma.refreshToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  });
  return count;
}
