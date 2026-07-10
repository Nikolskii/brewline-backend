import { Router } from 'express';
import type { OrderRepository } from '../repository/orderRepository.js';

/**
 * HTTP-слой: принимает запрос → зовёт репозиторий → отдаёт JSON.
 * Про MongoDB не знает ничего — работает через интерфейс OrderRepository.
 */
export function createOrderRoutes(repository: OrderRepository): Router {
  const router = Router();

  // GET /orders — снапшот активной очереди (контракт: openapi.yaml, operationId getOrders)
  router.get('/orders', async (_req, res) => {
    const orders = await repository.findActiveQueue();
    res.json(orders);
  });

  return router;
}
