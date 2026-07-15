import { describe, it, expect, vi } from 'vitest';
import { createOrderService } from './orderService.js';
import type { OrderRepository } from '../repository/orderRepository.js';
import type { QueueNotifier } from '../events/queueNotifier.js';
import type { Order } from '../domain/order.js';

const baseOrder: Order = {
  orderId: 'abc',
  number: 1,
  items: [{ name: 'Латте', quantity: 1 }],
  source: 'cashier',
  status: 'new',
  createdAt: '2026-07-10T09:00:00.000Z',
};

/** Фейковый репозиторий — тестируем сервис без Mongo. */
function fakeRepo(stored: Order | null): OrderRepository {
  return {
    findBoardSnapshot: async () => (stored ? [stored] : []),
    findById: async (id) => (stored && stored.orderId === id ? stored : null),
    updateStatus: async (id, status) =>
      stored && stored.orderId === id ? { ...stored, status } : null,
  };
}

/** Notifier со шпионом на emitChange. */
function spyNotifier(): QueueNotifier {
  return { emitChange: vi.fn(), onChange: vi.fn() };
}

describe('OrderService.changeStatus', () => {
  it('успешный переход new → preparing + публикует изменение', async () => {
    const notifier = spyNotifier();
    const service = createOrderService(fakeRepo(baseOrder), notifier);
    const result = await service.changeStatus('abc', 'preparing');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe('preparing');
    expect(notifier.emitChange).toHaveBeenCalledOnce();
  });

  it('несуществующий заказ → not_found, без публикации', async () => {
    const notifier = spyNotifier();
    const service = createOrderService(fakeRepo(baseOrder), notifier);
    const result = await service.changeStatus('missing', 'preparing');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(notifier.emitChange).not.toHaveBeenCalled();
  });

  it('недопустимый переход new → ready → invalid_transition, без публикации', async () => {
    const notifier = spyNotifier();
    const service = createOrderService(fakeRepo(baseOrder), notifier);
    const result = await service.changeStatus('abc', 'ready');
    expect(result).toEqual({ ok: false, reason: 'invalid_transition' });
    expect(notifier.emitChange).not.toHaveBeenCalled();
  });

  it('переход из терминального ready запрещён', async () => {
    const service = createOrderService(fakeRepo({ ...baseOrder, status: 'ready' }), spyNotifier());
    const result = await service.changeStatus('abc', 'preparing');
    expect(result).toEqual({ ok: false, reason: 'invalid_transition' });
  });
});
