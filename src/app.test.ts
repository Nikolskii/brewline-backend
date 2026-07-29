import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import type { QueueNotifier } from './events/queueNotifier.js';
import type { OrderService } from './service/orderService.js';

const ALLOWED = 'http://localhost:5174';
const FOREIGN = 'http://evil.example';

const service: OrderService = {
  getQueue: async () => [],
  changeStatus: async () => ({ ok: false, reason: 'not_found' }),
};

const notifier: QueueNotifier = { emitChange: vi.fn(), onChange: vi.fn() };

// Поднимаем настоящий HTTP-сервер на случайном порту (0 = «дай любой свободный»):
// CORS живёт в заголовках ответа, поэтому проверять его имеет смысл только
// сетевым запросом, а не вызовом обработчика напрямую.
let baseUrl: string;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

beforeAll(async () => {
  const app = createApp(service, notifier, [ALLOWED]);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('CORS', () => {
  it('разрешает читать ответ фронту из списка (ADR 0004)', async () => {
    const res = await fetch(`${baseUrl}/orders`, { headers: { Origin: ALLOWED } });

    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
    // Понадобится куке сессии бариста (ADR 0011).
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

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
