import { Router } from 'express';
import { isOrderStatus } from '../domain/order.js';
import type { OrderService } from '../service/orderService.js';

/**
 * HTTP-слой: парсинг запроса, вызов сервиса, выбор кода ответа.
 * Про Mongo и бизнес-правила не знает — работает через OrderService.
 */
export function createOrderRoutes(service: OrderService): Router {
  const router = Router();

  // GET /orders — снапшот активной очереди (openapi: getOrders)
  router.get('/orders', async (_req, res) => {
    const orders = await service.getQueue();
    res.json(orders);
  });

  // PATCH /orders/:orderId/status — смена статуса (openapi: updateOrderStatus)
  router.patch('/orders/:orderId/status', async (req, res) => {
    const status: unknown = (req.body as { status?: unknown } | undefined)?.status;

    // Валидация тела вручную: status должен быть валидным OrderStatus.
    if (!isOrderStatus(status)) {
      res.status(400).json({ error: 'status должен быть одним из: new, preparing, ready' });
      return;
    }

    const result = await service.changeStatus(req.params.orderId, status);

    if (result.ok) {
      res.json(result.order);
      return;
    }
    if (result.reason === 'not_found') {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    // invalid_transition
    res.status(409).json({ error: 'Недопустимый переход статуса' });
  });

  return router;
}
