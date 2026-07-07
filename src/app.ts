import express, { type Express } from 'express';

/**
 * Создаёт и настраивает Express-приложение, но НЕ запускает его.
 * Разделение «создать» и «запустить» позволит в тестах поднимать app
 * без реального сетевого порта.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  // Healthcheck — проверка, что сервис жив. Пригодится и для Docker/k8s.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
