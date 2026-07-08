/**
 * Доменная модель заказа и конечный автомат статусов (задача I3).
 *
 * Чистый домен: ноль зависимостей от Express и MongoDB. Это позволяет
 * тестировать логику переходов без запуска сервера и базы.
 *
 * Источник правды по домену — backend/«Описание компонента» и инструкция бариста.
 * Значения статусов — машинные коды (англ.); человекочитаемые надписи («Готовится»)
 * живут во фронте (слой представления).
 */

// --- Статусы -------------------------------------------------------------

/**
 * Допустимые статусы заказа В СКОУПЕ инкремента 1.
 * `Ожидает оплаты` (веб-форма + оплата, ADR 0007) добавим в инкременте оплаты.
 *
 * Массив-константа — единый источник: из него выводится тип OrderStatus,
 * и он же ляжет в enum OpenAPI-спеки (I4).
 */
export const ORDER_STATUSES = ['new', 'preparing', 'ready'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Источник заказа. */
export const ORDER_SOURCES = ['cashier', 'web'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

// --- Модель заказа -------------------------------------------------------

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface Order {
  orderId: string;
  /** Отображаемый номер заказа (для клиента и экрана). */
  number: number;
  items: OrderItem[];
  source: OrderSource;
  status: OrderStatus;
  /** Время поступления, ISO 8601. Определяет порядок в очереди. */
  createdAt: string;
}

// --- Автомат переходов ---------------------------------------------------

/**
 * Разрешённые переходы: статус меняется только ВПЕРЁД, по одному шагу.
 * `ready` — терминальный (переходов нет).
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

/** Статусы, входящие в активную очередь (её видят бариста и экран). */
export const ACTIVE_STATUSES: readonly OrderStatus[] = ['new', 'preparing'];

/**
 * Входит ли заказ с таким статусом в активную очередь.
 * `ready` — закрыт и в очередь не входит.
 */
export function isActiveStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}
