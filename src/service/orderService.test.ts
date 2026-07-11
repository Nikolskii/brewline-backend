import { describe, it, expect } from 'vitest';
import { createOrderService } from './orderService.js';
import type { OrderRepository } from '../repository/orderRepository.js';
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
    findActiveQueue: async () => (stored ? [stored] : []),
    findById: async (id) => (stored && stored.orderId === id ? stored : null),
    updateStatus: async (id, status) =>
      stored && stored.orderId === id ? { ...stored, status } : null,
  };
}

describe('OrderService.changeStatus', () => {
  it('успешный переход new → preparing', async () => {
    const service = createOrderService(fakeRepo(baseOrder));
    const result = await service.changeStatus('abc', 'preparing');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe('preparing');
  });

  it('несуществующий заказ → not_found', async () => {
    const service = createOrderService(fakeRepo(baseOrder));
    const result = await service.changeStatus('missing', 'preparing');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('недопустимый переход new → ready → invalid_transition', async () => {
    const service = createOrderService(fakeRepo(baseOrder));
    const result = await service.changeStatus('abc', 'ready');
    expect(result).toEqual({ ok: false, reason: 'invalid_transition' });
  });

  it('переход из терминального ready запрещён', async () => {
    const service = createOrderService(fakeRepo({ ...baseOrder, status: 'ready' }));
    const result = await service.changeStatus('abc', 'preparing');
    expect(result).toEqual({ ok: false, reason: 'invalid_transition' });
  });
});
