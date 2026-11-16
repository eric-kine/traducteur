import type { CookieOptions, Request, Response } from 'express';
import type { ChangePasswordInput, LoginInput } from '@scolarix/shared';
import { cookieSecure } from '../../config/env';
import * as authService from './auth.service';
import { REFRESH_COOKIE } from './tokens';

const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true, // illisible par le JavaScript du navigateur
  secure: cookieSecure, // HTTPS uniquement (en production)
  sameSite: 'strict',
  path: '/api/auth', // envoyé seulement aux routes d'authentification
  ...(expires && { expires }),
});

const clientInfo = (req: Request) => ({ userAgent: req.get('user-agent'), ipAddress: req.ip });

function sendSession(res: Response, session: authService.SessionResult) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions(session.refreshExpiresAt));
  res.json({ accessToken: session.accessToken, user: session.user });
}

export async function login(req: Request, res: Response) {
  const { email, password } = res.locals.body as LoginInput;
  sendSession(res, await authService.login(email, password, clientInfo(req)));
}

export async function refresh(req: Request, res: Response) {
  try {
    sendSession(res, await authService.refresh(req.cookies?.[REFRESH_COOKIE], clientInfo(req)));
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json({ user: await authService.getMe(req.user!.id) });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = res.locals.body as ChangePasswordInput;
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.status(204).end();
}
