import type { CookieOptions, Request, Response } from 'express';
import { env, isProd } from '../../config/env.js';
import { signToken } from '../../utils/jwt.js';
import type { LoginInput, SignupInput } from './auth.schema.js';
import * as authService from './auth.service.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

function setAuthCookie(res: Response, userId: string) {
  res.cookie(env.COOKIE_NAME, signToken(userId), { ...cookieOptions, maxAge: SEVEN_DAYS_MS });
}

export async function signup(req: Request, res: Response) {
  const user = await authService.signup(req.body as SignupInput);
  setAuthCookie(res, user.id);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const user = await authService.login(req.body as LoginInput);
  setAuthCookie(res, user.id);
  res.json({ user });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(env.COOKIE_NAME, cookieOptions);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const user = await authService.getUser(req.user!.id);
  res.json({ user });
}
