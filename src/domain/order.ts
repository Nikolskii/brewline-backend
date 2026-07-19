/**
 * Доменная логика заказа: автомат статусов и правила очереди (задача I3).
 *
 * ТИПЫ контракта (Order, OrderStatus, ...) — из OpenAPI (единый источник истины,
 * ADR 0008): генерируются в src/generated/openapi.ts скриптом `npm run gen:api`.
 * Здесь — только доменная ЛОГИКА поверх этих типов. Чистый домен: без Express/Mongo.
 */
import type { components } from '../generated/openapi.js';

// --- Типы из контракта ---------------------------------------------------

export type Order = components['schemas']['Order'];
export type OrderStatus = components['schemas']['OrderStatus'];
export type OrderSource = components['schemas']['OrderSource'];
export type OrderItem = components['schemas']['OrderItem'];

// --- Статусы (рантайм-значения) ------------------------------------------

/**
 * Список статусов для рантайма (итерация, сидинг, дефолты).
 * openapi-typescript даёт только ТИПЫ, не рантайм-массив, поэтому значения держим
 * здесь. `satisfies` гарантирует, что каждое значение — валидный OrderStatus из контракта.
 */
export const ORDER_STATUSES = [
  'new',
  'preparing',
  'ready',
] as const satisfies readonly OrderStatus[];

// --- Автомат переходов ---------------------------------------------------

/**
 * Разрешённые переходы: статус меняется только ВПЕРЁД, по одному шагу.
 * Тип Record<OrderStatus, ...> требует перечислить ВСЕ статусы — если в контракт
 * добавят новый, здесь появится ошибка компиляции (защита от рассинхрона).
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['preparing'],
  preparing: ['ready'],
  ready: [],
};

/** Разрешён ли переход from → to по автомату статусов. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Type guard: пришедшее извне значение — валидный OrderStatus. */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

// --- Очередь -------------------------------------------------------------

/**
 * Активная РАБОТА бариста: заказы, которые он ведёт (new + preparing).
 * `ready` сюда не входит — с точки зрения бариста заказ завершён.
 * На ТАБЛО в зале показываются активные + свежие `ready` («заберите на баре»):
 * правило видимости `ready` с TTL живёт в репозитории (нужна отметка времени).
 */
export const ACTIVE_STATUSES = ['new', 'preparing'] as const satisfies readonly OrderStatus[];

export function isActiveStatus(status: OrderStatus): boolean {
  return (ACTIVE_STATUSES as readonly OrderStatus[]).includes(status);
}
