/**
 * Доменная логика заказа: автомат статусов и правила очереди (задача I3).
 *
 * ТИПЫ и рантайм-значения контракта — из zod-схем (src/contract/schemas.ts,
 * ADR 0010). Здесь — только доменная ЛОГИКА поверх них: что такое «переход
 * вперёд» и «активный заказ». Чистый домен: без Express/Mongo.
 */
import type { OrderStatus } from '../contract/schemas.js';

// Реэкспорт типов контракта: остальной код (сервис, репозиторий, роуты) работает
// с доменом и не обязан знать, что типы физически заданы схемами в contract/.
export type {
  Order,
  OrderItem,
  OrderSource,
  OrderStatus,
} from '../contract/schemas.js';

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
