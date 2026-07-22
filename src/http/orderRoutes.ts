import { Router } from 'express';
import { UpdateOrderStatusRequestSchema } from '../contract/schemas.js';
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
    // Валидация тела схемой контракта (ADR 0010): та же схема, из которой
    // сгенерирована спека, — расходиться с контрактом ей физически негде.
    // safeParse не бросает исключение, а возвращает результат-объединение.
    const parsed = UpdateOrderStatusRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Тело запроса не соответствует контракту',
        details: parsed.error.issues,
      });
      return;
    }

    const result = await service.changeStatus(
      req.params.orderId,
      parsed.data.status,
    );

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
