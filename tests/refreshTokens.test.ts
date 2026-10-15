import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  REUSE_GRACE_MS,
  deleteOldRefreshTokens,
  hashToken,
} from '../src/modules/auth/refreshTokens.service.js';
import { cookieValue, resetDb, setCookie } from './helpers.js';

const app = createApp();
const user = { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-1' };
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Sign up and return the raw access and refresh tokens from the cookies. */
async function signup() {
  const res = await request(app)
    .post('/api/auth/signup')
    .set('User-Agent', 'test-browser')
    .send(user);
  return {
    access: cookieValue(setCookie(res, 'dsa_token')),
    refresh: cookieValue(setCookie(res, 'dsa_refresh')),
  };
}

const refreshWith = (token: string) =>
  request(app).post('/api/auth/refresh').set('Cookie', `dsa_refresh=${token}`);

const meWith = (access: string) =>
  request(app).get('/api/auth/me').set('Cookie', `dsa_token=${access}`);

/** Move the clock forward (only Date is faked, so the database driver keeps working). */
function advanceClock(ms: number) {
  if (!vi.isFakeTimers()) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date());
  }
  vi.setSystemTime(Date.now() + ms);
}

function expectCookiesCleared(res: request.Response) {
  expect(setCookie(res, 'dsa_token')).toMatch(/Expires=Thu, 01 Jan 1970/);
  expect(setCookie(res, 'dsa_refresh')).toMatch(/Expires=Thu, 01 Jan 1970/);
}

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('signup / login', () => {
  it('stores only a hash of the refresh token, never the raw token', async () => {
    const { refresh } = await signup();
    const rows = await prisma.refreshToken.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashToken(refresh));
    expect(rows[0]!.tokenHash).not.toBe(refresh);
    expect(rows[0]!.userAgent).toBe('test-browser');
    expect(refresh.length).toBeGreaterThanOrEqual(80); // 64 random bytes
  });

  it('each login starts a new token family', async () => {
    await signup();
    await request(app).post('/api/auth/login').send(user);
    const families = new Set((await prisma.refreshToken.findMany()).map((r) => r.familyId));
    expect(families.size).toBe(2);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the token: new cookies, old row revoked and linked to the new one', async () => {
    const { refresh: oldToken } = await signup();

    const res = await refreshWith(oldToken);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: expect.any(String), name: 'Ada', email: 'ada@example.com' },
    });

    const newToken = cookieValue(setCookie(res, 'dsa_refresh'));
    expect(newToken).not.toBe(oldToken);
    expect(setCookie(res, 'dsa_token')).toMatch(/Max-Age=900;/);

    const oldRow = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(oldToken) },
    });
    const newRow = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(newToken) },
    });
    expect(oldRow.revokedAt).not.toBeNull();
    expect(oldRow.replacedById).toBe(newRow.id);
    expect(newRow.familyId).toBe(oldRow.familyId);
    expect(newRow.revokedAt).toBeNull();

    // The new token works for the next refresh.
    expect((await refreshWith(newToken)).status).toBe(200);
  });

  it('after the grace period, the old token no longer works', async () => {
    const { refresh: oldToken } = await signup();
    await refreshWith(oldToken);

    advanceClock(REUSE_GRACE_MS + 1000);
    const res = await refreshWith(oldToken);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expectCookiesCleared(res);
  });

  it('reusing an old token kills the whole family', async () => {
    const { refresh: oldToken } = await signup();
    const rotated = await refreshWith(oldToken);
    const newToken = cookieValue(setCookie(rotated, 'dsa_refresh'));

    advanceClock(REUSE_GRACE_MS + 1000);
    expect((await refreshWith(oldToken)).status).toBe(401); // the "thief"

    // The real user's newer token is now dead too.
    expect((await refreshWith(newToken)).status).toBe(401);
    const active = await prisma.refreshToken.count({ where: { revokedAt: null } });
    expect(active).toBe(0);
  });

  it('within the grace period (two tabs), the old token gets a new access cookie only', async () => {
    const { refresh: oldToken } = await signup();
    const first = await refreshWith(oldToken);
    const newToken = cookieValue(setCookie(first, 'dsa_refresh'));

    const second = await refreshWith(oldToken);
    expect(second.status).toBe(200);
    expect(setCookie(second, 'dsa_token')).toMatch(/Max-Age=900;/);
    expect(() => setCookie(second, 'dsa_refresh')).toThrow(); // browser keeps the newest one

    // Nothing was killed: the newest token still works.
    expect((await refreshWith(newToken)).status).toBe(200);
  });

  it('two refreshes at the same moment rotate only once', async () => {
    const { refresh } = await signup();
    const results = await Promise.all([refreshWith(refresh), refreshWith(refresh)]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await prisma.refreshToken.count()).toBe(2); // the original + exactly one new token
  });

  it('an expired refresh token is rejected and both cookies are cleared', async () => {
    const { refresh } = await signup();
    advanceClock(7 * DAY + 1000);

    const res = await refreshWith(refresh);
    expect(res.status).toBe(401);
    expectCookiesCleared(res);
  });

  it('a missing or unknown refresh token is rejected', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
    expect((await refreshWith('not-a-real-token')).status).toBe(401);
  });

  it('gets a new access token after the old one expires', async () => {
    const { access, refresh } = await signup();
    expect((await meWith(access)).status).toBe(200);

    advanceClock(15 * MINUTE + 1000);
    expect((await meWith(access)).status).toBe(401); // access token expired

    const refreshed = await refreshWith(refresh);
    expect(refreshed.status).toBe(200);
    const newAccess = cookieValue(setCookie(refreshed, 'dsa_token'));
    expect((await meWith(newAccess)).status).toBe(200);
  });

  it('fails once the user is deleted', async () => {
    const { refresh } = await signup();
    await prisma.user.deleteMany();
    expect((await refreshWith(refresh)).status).toBe(401);
  });
});

describe('logout', () => {
  it('revokes the current refresh token and clears both cookies', async () => {
    const { refresh } = await signup();

    const res = await request(app).post('/api/auth/logout').set('Cookie', `dsa_refresh=${refresh}`);
    expect(res.status).toBe(204);
    expectCookiesCleared(res);
    expect((await refreshWith(refresh)).status).toBe(401);
  });

  it('works with no cookies at all', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });
});

describe('POST /api/auth/logout-all', () => {
  it('needs login', async () => {
    expect((await request(app).post('/api/auth/logout-all')).status).toBe(401);
  });

  it("logs out every device: each device's refresh fails", async () => {
    const laptop = await signup();
    const phoneRes = await request(app).post('/api/auth/login').send(user);
    const phone = cookieValue(setCookie(phoneRes, 'dsa_refresh'));

    const res = await request(app)
      .post('/api/auth/logout-all')
      .set('Cookie', `dsa_token=${laptop.access}`);
    expect(res.status).toBe(204);
    expectCookiesCleared(res);

    expect((await refreshWith(laptop.refresh)).status).toBe(401);
    expect((await refreshWith(phone)).status).toBe(401);
  });
});

describe('deleteOldRefreshTokens', () => {
  it('deletes only tokens that expired or were revoked more than 7 days ago', async () => {
    await signup();
    const { userId, familyId } = await prisma.refreshToken.findFirstOrThrow();
    const ago = (ms: number) => new Date(Date.now() - ms);
    const row = (tokenHash: string, expiresAt: Date, revokedAt: Date | null = null) => ({
      userId,
      familyId,
      tokenHash,
      expiresAt,
      revokedAt,
    });

    await prisma.refreshToken.createMany({
      data: [
        row('a'.repeat(64), ago(8 * DAY)), // expired long ago → delete
        row('b'.repeat(64), ago(-1 * DAY), ago(8 * DAY)), // revoked long ago → delete
        row('c'.repeat(64), ago(-1 * DAY), ago(1 * DAY)), // revoked recently → keep
      ],
    });

    expect(await deleteOldRefreshTokens()).toBe(2);
    expect(await prisma.refreshToken.count()).toBe(2); // signup's active token + the recent one
  });
});

describe('rate limit', () => {
  it('allows 30 refreshes per minute per IP, then 429', async () => {
    const limited = createApp({ rateLimit: true });
    for (let i = 0; i < 30; i++) {
      const res = await request(limited).post('/api/auth/refresh');
      expect(res.status).toBe(401); // no cookie, but not rate limited
    }
    const blocked = await request(limited).post('/api/auth/refresh');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
