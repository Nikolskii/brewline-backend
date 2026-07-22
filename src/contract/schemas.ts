/**
 * ПЕРВИЧНОЕ ОПИСАНИЕ КОНТРАКТА (ADR 0010).
 *
 * Здесь — единственное место, где задана форма данных Brewline. Из этих схем
 * получаются три вещи:
 *   1. рантайм-валидация входящих запросов (HTTP-слой, safeParse);
 *   2. TypeScript-типы (z.infer) — их же публикуем фронтам через OpenAPI;
 *   3. openapi/openapi.yaml (scripts/generate-openapi.ts).
 *
 * Правило: меняешь контракт — меняешь схему здесь, потом `npm run gen:api`.
 * Править openapi.yaml руками бессмысленно — правки затрёт генератор.
 *
 * Модуль намеренно НЕ знает про OpenAPI: он импортирует только zod, поэтому
 * попадает в прод-сборку без генератора спеки (тот живёт в devDependencies).
 *
 * `.meta({ id })` — штатный механизм zod 4. Генератор спеки читает `id` и
 * выносит схему в components/schemas под этим именем (то есть в спеке будет
 * $ref, а не инлайн-копия). Благодаря этому обходимся без extendZodWithOpenApi:
 * прототип zod не патчится, схемы остаются обычными zod-схемами.
 */
import { z } from 'zod';

// --- Доменные схемы ------------------------------------------------------

export const OrderStatusSchema = z.enum(['new', 'preparing', 'ready']).meta({
  id: 'OrderStatus',
  description:
    'Статус заказа. Меняется только вперёд (new → preparing → ready).',
});

export const OrderSourceSchema = z.enum(['cashier', 'web']).meta({
  id: 'OrderSource',
  description: 'Источник заказа.',
});

export const OrderItemSchema = z
  .object({
    name: z.string().min(1).describe('Название напитка.'),
    quantity: z.number().int().min(1).describe('Количество порций.'),
  })
  .meta({ id: 'OrderItem', description: 'Позиция заказа.' });

export const OrderSchema = z
  .object({
    orderId: z.string().describe('Идентификатор заказа.'),
    number: z.number().int().describe('Отображаемый номер заказа.'),
    items: z.array(OrderItemSchema).describe('Состав заказа.'),
    source: OrderSourceSchema,
    status: OrderStatusSchema,
    // z.iso.datetime() не только даёт format: date-time в спеке, но и реально
    // проверяет формат в рантайме — обычный z.string() пропустил бы что угодно.
    createdAt: z.iso
      .datetime()
      .describe('Время поступления (ISO 8601). Определяет порядок в очереди.'),
  })
  .meta({ id: 'Order', description: 'Заказ в очереди.' });

// --- Схемы запросов ------------------------------------------------------

export const UpdateOrderStatusRequestSchema = z
  .object({
    status: OrderStatusSchema,
  })
  .meta({ id: 'UpdateOrderStatusRequest' });

// --- Типы (выводятся из схем, руками не пишутся) -------------------------

export type Order = z.infer<typeof OrderSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderSource = z.infer<typeof OrderSourceSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type UpdateOrderStatusRequest = z.infer<
  typeof UpdateOrderStatusRequestSchema
>;

// --- Рантайм-значения ----------------------------------------------------

/**
 * Список статусов для рантайма (итерация, сидинг, дефолты).
 * Раньше писался руками и страховался `satisfies`; теперь берётся из самой
 * схемы — разойтись с контрактом физически не может.
 */
export const ORDER_STATUSES = OrderStatusSchema.options;
