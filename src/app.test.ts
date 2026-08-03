import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { createAuthService } from './auth/authService.js';
import type { QueueNotifier } from './events/queueNotifier.js';
import type { OrderService } from './service/orderService.js';

const ALLOWED = 'http://localhost:5174';
const LOOPBACK_ALLOWED = 'http://127.0.0.1:5174';
const FOREIGN = 'http://evil.example';

const service: OrderService = {
  getQueue: async () => [],
  changeStatus: async () => ({ ok: false, reason: 'not_found' }),
};

const notifier: QueueNotifier = { emitChange: vi.fn(), onChange: vi.fn() };
const auth = createAuthService({
  // bcrypt-хеш строки "barista"; тест не зависит от секретов окружения.
  passwordHash: '$2b$10$.gXPWff3y5GiWrNzbWHW4ua5l6BrXQqrRMdCXA56IR7j.mmgi2rDC',
  sessionSecret: 'test-session-secret',
  sessionTtlMs: 60_000,
});
const authRouteOptions = { sessionTtlMs: 60_000, secureCookies: false };

// Поднимаем настоящий HTTP-сервер на случайном порту (0 = «дай любой свободный»):
// CORS живёт в заголовках ответа, поэтому проверять его имеет смысл только
// сетевым запросом, а не вызовом обработчика напрямую.
let baseUrl: string;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

beforeAll(async () => {
  const app = createApp(service, notifier, [ALLOWED, LOOPBACK_ALLOWED], auth, authRouteOptions);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('CORS', () => {
  it.each([ALLOWED, LOOPBACK_ALLOWED])(
    'разрешает читать ответ фронту %s из списка (ADR 0004)',
    async (origin) => {
      const res = await fetch(`${baseUrl}/orders`, { headers: { Origin: origin } });

      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
      // Понадобится куке сессии бариста (ADR 0011).
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    },
  );

  it('не разрешает читать ответ постороннему origin', async () => {
    const res = await fetch(`${baseUrl}/orders`, { headers: { Origin: FOREIGN } });

    // Сервер отвечает как обычно — запрет накладывает браузер, увидев,
    // что разрешающего заголовка нет. Это и проверяем.
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('отвечает на preflight перед сменой статуса', async () => {
    const res = await fetch(`${baseUrl}/orders/abc/status`, {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED,
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
    expect(res.headers.get('access-control-allow-methods')).toContain('PATCH');
  });
});

describe('аутентификация бариста', () => {
  it('не даёт менять статус без сессии, сохраняя GET /orders публичным', async () => {
    const getResponse = await fetch(`${baseUrl}/orders`);
    const patchResponse = await fetch(`${baseUrl}/orders/abc/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'preparing' }),
    });

    expect(getResponse.status).toBe(200);
    expect(patchResponse.status).toBe(401);
  });

  it('ставит httpOnly-сессию при верном пароле и удаляет её при выходе', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ALLOWED },
      body: JSON.stringify({ password: 'barista' }),
    });
    const setCookie = loginResponse.headers.get('set-cookie');

    expect(loginResponse.status).toBe(200);
    expect(await loginResponse.json()).toEqual({ authenticated: true });
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');

    const cookie = setCookie?.split(';', 1)[0];
    const sessionResponse = await fetch(`${baseUrl}/auth/session`, {
      headers: { Cookie: cookie ?? '' },
    });
    const authorizedPatch = await fetch(`${baseUrl}/orders/abc/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie ?? '' },
      body: JSON.stringify({ status: 'preparing' }),
    });
    const logoutResponse = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie ?? '' },
    });
    const expiredSessionResponse = await fetch(`${baseUrl}/auth/session`, {
      headers: { Cookie: cookie ?? '' },
    });

    expect(await sessionResponse.json()).toEqual({ authenticated: true });
    // Сервис в тесте отдаёт not_found, то есть до бизнес-логики запрос дошёл.
    expect(authorizedPatch.status).toBe(404);
    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970');
    expect(await expiredSessionResponse.json()).toEqual({ authenticated: false });
  });

  it('не создаёт сессию при неверном пароле', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
