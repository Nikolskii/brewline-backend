import type { Db, ObjectId, Collection } from 'mongodb';
import {
  ACTIVE_STATUSES,
  type Order,
  type OrderItem,
  type OrderSource,
  type OrderStatus,
} from '../domain/order.js';

/**
 * Слой доступа к данным. ЕДИНСТВЕННОЕ место, которое знает про MongoDB.
 * Наружу отдаёт доменные типы (Order), внутрь прячет форму документа.
 */

/** Форма документа в коллекции `orders` (то, что реально лежит в базе). */
export interface OrderDocument {
  _id: ObjectId;
  number: number;
  items: OrderItem[];
  source: OrderSource;
  status: OrderStatus;
  /** В базе — BSON Date: сортируется и индексируется. Наружу отдаём ISO-строкой. */
  createdAt: Date;
}

/** Документ Mongo → доменный Order (форма контракта). */
function toDomain(doc: OrderDocument): Order {
  return {
    orderId: doc._id.toHexString(),
    number: doc.number,
    items: doc.items,
    source: doc.source,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

export interface OrderRepository {
  /** Активная очередь: статусы new + preparing, по возрастанию createdAt. */
  findActiveQueue(): Promise<Order[]>;
}

/**
 * Фабрика репозитория. Db передаётся снаружи (внедрение зависимости),
 * а не берётся из глобали — так слой легко подменить в тестах.
 */
export function createOrderRepository(db: Db): OrderRepository {
  const orders: Collection<OrderDocument> = db.collection<OrderDocument>('orders');

  return {
    async findActiveQueue(): Promise<Order[]> {
      const docs = await orders
        // Правило «что входит в очередь» живёт в домене — здесь только применяем.
        .find({ status: { $in: [...ACTIVE_STATUSES] } })
        .sort({ createdAt: 1 })
        .toArray();

      return docs.map(toDomain);
    },
  };
}
