import { Router } from 'express';
import { LoginRequestSchema } from '../contract/schemas.js';
import type { AuthService } from '../auth/authService.js';

export const SESSION_COOKIE_NAME = 'brewline_barista_session';

export interface AuthRouteOptions {
  sessionTtlMs: number;
  secureCookies: boolean;
}

export function createAuthRoutes(auth: AuthService, options: AuthRouteOptions): Router {
  const router = Router();

  router.post('/auth/login', async (req, res) => {
    const parsed = LoginRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Тело запроса не соответствует контракту',
        details: parsed.error.issues,
      });
      return;
    }

    const sessionToken = await auth.login(parsed.data.password);

    if (!sessionToken) {
      res.status(401).json({ error: 'Неверный пароль смены' });
      return;
    }

    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      maxAge: options.sessionTtlMs,
      sameSite: 'lax',
      secure: options.secureCookies,
    });
    res.json({ authenticated: true });
  });

  router.post('/auth/logout', (req, res) => {
    auth.logout(readSessionToken(req.headers.cookie));
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.secureCookies,
    });
    res.status(204).end();
  });

  router.get('/auth/session', (req, res) => {
    res.json({ authenticated: auth.hasSession(readSessionToken(req.headers.cookie)) });
  });

  return router;
}

export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const prefix = `${SESSION_COOKIE_NAME}=`;
  const cookie = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}
