import express, { type Express } from 'express';
import { createOrderRoutes } from './http/orderRoutes.js';
import { createOrderStream } from './http/orderStream.js';
import type { OrderService } from './service/orderService.js';
import type { QueueNotifier } from './events/queueNotifier.js';

/**
 * Создаёт и настраивает Express-приложение, но НЕ запускает его.
 * Зависимости (сервис, notifier) передаются снаружи — приложение не создаёт их само.
 * Благодаря этому в тестах можно поднять app с фейковыми зависимостями, без Mongo.
 */
export function createApp(service: OrderService, notifier: QueueNotifier): Express {
  const app = express();

  app.use(express.json());

  // Healthcheck — проверка, что сервис жив. Пригодится и для Docker/k8s.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(createOrderRoutes(service));
  app.use(createOrderStream(service, notifier));

  return app;
}
