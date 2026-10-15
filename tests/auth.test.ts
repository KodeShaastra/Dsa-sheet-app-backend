import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { cookieValue, detailPaths, setCookie } from './helpers.js';

const app = createApp();
const user = { email: '  Ada@Example.COM ', name: 'Ada', password: 'correct-horse-1' };
const login = { email: 'ada@example.com', password: user.password };

const authCookie = (res: request.Response) => setCookie(res, 'dsa_token');

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/signup', () => {
  it('creates the user with a trimmed, lowercased email', async () => {
    const res = await request(app).post('/api/auth/signup').send(user);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: { id: expect.any(String), name: 'Ada', email: 'ada@example.com' },
    });
  });

  it('hashes the password with bcrypt cost 12', async () => {
    await request(app).post('/api/auth/signup').send(user);
    const row = await prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(row.passwordHash).not.toContain(user.password);
  });

  it('sets the access and refresh cookies with the right flags', async () => {
    const res = await request(app).post('/api/auth/signup').send(user);
    const access = setCookie(res, 'dsa_token');
    const refresh = setCookie(res, 'dsa_refresh');
    for (const cookie of [access, refresh]) {
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).not.toMatch(/Secure/); // only in production
    }
    expect(access).toMatch(/Max-Age=900;/); // 15 minutes
    expect(refresh).toMatch(/Max-Age=604800;/); // 7 days
  });

  it('never puts a token in the response body', async () => {
    const res = await request(app).post('/api/auth/signup').send(user);
    expect(Object.keys(res.body)).toEqual(['user']);
    expect(JSON.stringify(res.body)).not.toContain(cookieValue(setCookie(res, 'dsa_refresh')));
  });

  it('puts { sub: userId } in the JWT', async () => {
    const res = await request(app).post('/api/auth/signup').send(user);
    const token = authCookie(res).split(';')[0]!.split('=')[1]!;
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(payload.sub).toBe(res.body.user.id);
  });

  it('rejects a duplicate email, even with different case', async () => {
    await request(app).post('/api/auth/signup').send(user);
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...user, email: 'ADA@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects bad input with field errors', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', name: '', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(detailPaths(res.body)).toEqual(expect.arrayContaining(['email', 'name', 'password']));
  });

  it('rejects broken JSON', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('no longer answers on the old /register path', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/signup').send(user);
  });

  it('logs in with any case and extra spaces in the email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ' ADA@example.com ', password: user.password });
    expect(res.status).toBe(200);
    expect(authCookie(res)).toMatch(/HttpOnly/);
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ ...login, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ ...login, email: 'nobody@example.com' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.message).toBe('Invalid email or password');
  });
});

describe('requireAuth, /me and logout', () => {
  it('reads /me with the cookie, then logs out', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send(user);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ada@example.com');

    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('returns 401 for a missing, fake, wrongly signed, or expired token', async () => {
    const res = await request(app).post('/api/auth/signup').send(user);
    const id: string = res.body.user.id;
    const secret = process.env.JWT_SECRET!;

    const tokens = [
      'abc.def.ghi',
      jwt.sign({ sub: id }, 'some-other-secret-that-is-long-enough-123'),
      jwt.sign({ sub: id, exp: Math.floor(Date.now() / 1000) - 60 }, secret),
    ];

    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    for (const token of tokens) {
      const r = await request(app).get('/api/auth/me').set('Cookie', `dsa_token=${token}`);
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('UNAUTHORIZED');
    }
  });
});

describe('passwordHash is never returned', () => {
  it('is missing from signup, login, and /me responses', async () => {
    const agent = request.agent(app);
    const responses = [
      await agent.post('/api/auth/signup').send(user),
      await agent.post('/api/auth/login').send(login),
      await agent.get('/api/auth/me'),
    ];
    for (const res of responses) {
      expect(res.status).toBeLessThan(300);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
    }
  });
});

describe('rate limits (5 requests/min per IP)', () => {
  it('blocks the 6th login attempt with 429', async () => {
    const limited = createApp({ rateLimit: true });
    for (let i = 0; i < 5; i++) {
      const res = await request(limited).post('/api/auth/login').send(login);
      expect(res.status).not.toBe(429);
    }
    const blocked = await request(limited).post('/api/auth/login').send(login);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('blocks the 6th signup attempt, with its own counter separate from login', async () => {
    const limited = createApp({ rateLimit: true });
    for (let i = 0; i < 5; i++) {
      await request(limited).post('/api/auth/login').send(login);
    }
    for (let i = 0; i < 5; i++) {
      const res = await request(limited)
        .post('/api/auth/signup')
        .send({ ...user, email: `user${i}@example.com` });
      expect(res.status).not.toBe(429);
    }
    const blocked = await request(limited)
      .post('/api/auth/signup')
      .send({ ...user, email: 'user6@example.com' });
    expect(blocked.status).toBe(429);
  });
});
