import { Router, type Response } from 'express';
import type { OrderService } from '../service/orderService.js';
import type { QueueNotifier } from '../events/queueNotifier.js';

/**
 * SSE-хаб (ADR 0001): держит открытые соединения и при каждом изменении очереди
 * рассылает всем полный снапшот. Формат события:
 *
 *   event: snapshot
 *   data: <JSON-массив Order>
 *
 * Про смену статуса знает только через notifier (не про PATCH напрямую).
 */
const HEARTBEAT_MS = 15_000;

export function createOrderStream(service: OrderService, notifier: QueueNotifier): Router {
  const router = Router();
  const clients = new Set<Response>();

  function sendSnapshot(res: Response, snapshot: unknown): void {
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
  }

  // Одна подписка на изменения — рассылаем снапшот всем подключённым.
  notifier.onChange(() => {
    void (async () => {
      const snapshot = await service.getQueue();
      for (const res of clients) sendSnapshot(res, snapshot);
    })();
  });

  // GET /orders/stream (openapi: streamOrders)
  router.get('/orders/stream', async (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();

    clients.add(res);

    // Начальный снапшот сразу при подключении — клиент не ждёт первого изменения.
    sendSnapshot(res, await service.getQueue());

    // Heartbeat-комментарий: держит «тихое» соединение живым (прокси/таймауты).
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    // Клиент отключился — чистим ресурсы, иначе утечка соединений/таймеров.
    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
  });

  return router;
}
