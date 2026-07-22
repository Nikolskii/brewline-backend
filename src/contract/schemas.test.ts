import { describe, expect, it } from 'vitest';

import {
  ORDER_STATUSES,
  OrderSchema,
  UpdateOrderStatusRequestSchema,
} from './schemas.js';

/**
 * Это тесты КОНТРАКТА, а не бизнес-логики: они фиксируют, что схемы реально
 * отбраковывают мусор. До перехода на zod (ADR 0010) такой защиты не было —
 * типы стирались при компиляции, и в рантайм проходило что угодно.
 */

describe('UpdateOrderStatusRequestSchema — валидация тела запроса', () => {
  it('принимает валидный статус', () => {
    const result = UpdateOrderStatusRequestSchema.safeParse({
      status: 'preparing',
    });
    expect(result.success).toBe(true);
  });

  it('отвергает неизвестный статус', () => {
    expect(
      UpdateOrderStatusRequestSchema.safeParse({ status: 'чепуха' }).success,
    ).toBe(false);
  });

  it('отвергает тело без status и не-объект', () => {
    expect(UpdateOrderStatusRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateOrderStatusRequestSchema.safeParse(undefined).success).toBe(
      false,
    );
    expect(UpdateOrderStatusRequestSchema.safeParse('preparing').success).toBe(
      false,
    );
  });
});

describe('OrderSchema — форма заказа', () => {
  const valid = {
    orderId: '6a5c7b665382e7a528e74414',
    number: 101,
    items: [{ name: 'Латте', quantity: 1 }],
    source: 'cashier',
    status: 'new',
    createdAt: '2026-07-19T07:15:18.026Z',
  };

  it('принимает корректный заказ', () => {
    expect(OrderSchema.safeParse(valid).success).toBe(true);
  });

  it('отвергает нулевое и дробное количество', () => {
    expect(
      OrderSchema.safeParse({ ...valid, items: [{ name: 'Латте', quantity: 0 }] })
        .success,
    ).toBe(false);
    expect(
      OrderSchema.safeParse({
        ...valid,
        items: [{ name: 'Латте', quantity: 1.5 }],
      }).success,
    ).toBe(false);
  });

  it('отвергает createdAt не в формате ISO 8601', () => {
    expect(OrderSchema.safeParse({ ...valid, createdAt: '19.07.2026' }).success).toBe(
      false,
    );
  });

  it('отвергает неизвестный источник заказа', () => {
    expect(OrderSchema.safeParse({ ...valid, source: 'telepathy' }).success).toBe(
      false,
    );
  });
});

describe('ORDER_STATUSES — рантайм-значения', () => {
  it('выводятся из схемы, а не пишутся руками', () => {
    expect(ORDER_STATUSES).toEqual(['new', 'preparing', 'ready']);
  });
});
