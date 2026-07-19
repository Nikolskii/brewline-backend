import { canTransition, type Order, type OrderStatus } from '../domain/order.js';
import type { OrderRepository } from '../repository/orderRepository.js';
import type { QueueNotifier } from '../events/queueNotifier.js';

/**
 * Прикладной слой (use-cases). Оркестрирует домен и репозиторий; сам не знает
 * ни про HTTP, ни про Mongo. HTTP-коды выбирает роут по этому результату.
 */

/** Результат смены статуса — размеченное объединение вместо исключений. */
export type ChangeStatusResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'not_found' | 'invalid_transition' };

export interface OrderService {
  getQueue(): Promise<Order[]>;
  changeStatus(orderId: string, to: OrderStatus): Promise<ChangeStatusResult>;
}

export function createOrderService(
  repository: OrderRepository,
  notifier: QueueNotifier,
  readyTtlMs: number,
): OrderService {
  return {
    getQueue() {
      return repository.findBoardSnapshot();
    },

    async changeStatus(orderId: string, to: OrderStatus): Promise<ChangeStatusResult> {
      const order = await repository.findById(orderId);
      if (!order) return { ok: false, reason: 'not_found' };

      // Ключевое правило домена: переход только вперёд по автомату.
      if (!canTransition(order.status, to)) {
        return { ok: false, reason: 'invalid_transition' };
      }

      const updated = await repository.updateStatus(orderId, to);
      if (!updated) return { ok: false, reason: 'not_found' };

      // Очередь изменилась — публикуем, чтобы SSE-хаб разослал снапшот.
      notifier.emitChange();

      // Заказ стал ready → через TTL он должен уйти с табло. Планируем повторную
      // рассылку: по таймеру снапшот пересчитается уже без просроченного ready.
      if (to === 'ready') {
        setTimeout(() => notifier.emitChange(), readyTtlMs).unref();
      }

      return { ok: true, order: updated };
    },
  };
}
