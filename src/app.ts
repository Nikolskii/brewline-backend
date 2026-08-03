import cors from 'cors';
import express, { type Express } from 'express';
import type { AuthService } from './auth/authService.js';
import { createAuthRoutes, type AuthRouteOptions } from './http/authRoutes.js';
import { createOrderRoutes } from './http/orderRoutes.js';
import { createOrderStream } from './http/orderStream.js';
import type { OrderService } from './service/orderService.js';
import type { QueueNotifier } from './events/queueNotifier.js';

/**
 * Создаёт и настраивает Express-приложение, но НЕ запускает его.
 * Зависимости (сервис, notifier) передаются снаружи — приложение не создаёт их само.
 * Благодаря этому в тестах можно поднять app с фейковыми зависимостями, без Mongo.
 */
export function createApp(
  service: OrderService,
  notifier: QueueNotifier,
  corsOrigins: string[],
  auth: AuthService,
  authRouteOptions: AuthRouteOptions,
): Express {
  const app = express();

  // Фронты живут на других origin, чем API (ADR 0004), поэтому ответы читаются
  // браузером только с разрешающими заголовками. Мидлварь идёт первой: preflight
  // OPTIONS должен получить ответ раньше, чем дойдёт до маршрутов.
  //
  // credentials нужен сессии бариста: браузер не сохранит и не приложит cookie
  // к cross-origin fetch без него (ADR 0011).
  app.use(cors({ origin: corsOrigins, credentials: true }));

  app.use(express.json());

  // Healthcheck — проверка, что сервис жив. Пригодится и для Docker/k8s.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(createAuthRoutes(auth, authRouteOptions));
  app.use(createOrderRoutes(service, auth));
  app.use(createOrderStream(service, notifier));

  return app;
}
