import type { CookieOptions, Request, Response } from 'express';
import { env, isProd } from '../../config/env.js';
import { readCookie } from '../../utils/cookies.js';
import type { LoginInput, SignupInput } from './auth.schema.js';
import * as authService from './auth.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

function setSessionCookies(res: Response, tokens: authService.SessionTokens) {
  res.cookie(env.COOKIE_NAME, tokens.accessToken, {
    ...cookieOptions,
    maxAge: env.ACCESS_TOKEN_TTL,
  });
  if (tokens.refreshToken) {
    res.cookie(env.REFRESH_COOKIE_NAME, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS,
    });
  }
}

function clearSessionCookies(res: Response) {
  res.clearCookie(env.COOKIE_NAME, cookieOptions);
  res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions);
}

const userAgent = (req: Request): string | null => req.get('user-agent')?.slice(0, 500) ?? null;
const refreshCookie = (req: Request): string | null =>
  readCookie(req.cookies, env.REFRESH_COOKIE_NAME);

export async function signup(req: Request, res: Response) {
  const user = await authService.signup(req.body as SignupInput);
  setSessionCookies(res, await authService.startSession(user.id, userAgent(req)));
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const user = await authService.login(req.body as LoginInput);
  setSessionCookies(res, await authService.startSession(user.id, userAgent(req)));
  res.json({ user });
}

export async function refresh(req: Request, res: Response) {
  try {
    const { user, tokens } = await authService.refreshSession(refreshCookie(req), userAgent(req));
    setSessionCookies(res, tokens);
    res.json({ user });
  } catch (err) {
    clearSessionCookies(res); // the error handler still sends the 401
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.endSession(refreshCookie(req));
  clearSessionCookies(res);
  res.status(204).end();
}

export async function logoutAll(req: Request, res: Response) {
  await authService.endAllSessions(req.user!.id);
  clearSessionCookies(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const user = await authService.getUser(req.user!.id);
  res.json({ user });
}
