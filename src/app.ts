import express, { type Express } from 'express';
import { createOrderRoutes } from './http/orderRoutes.js';
import type { OrderRepository } from './repository/orderRepository.js';

/**
 * Создаёт и настраивает Express-приложение, но НЕ запускает его.
 * Зависимости (репозиторий) передаются снаружи — приложение не создаёт их само.
 * Благодаря этому в тестах можно поднять app с фейковым репозиторием, без Mongo.
 */
export function createApp(repository: OrderRepository): Express {
  const app = express();

  app.use(express.json());

  // Healthcheck — проверка, что сервис жив. Пригодится и для Docker/k8s.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(createOrderRoutes(repository));

  return app;
}
