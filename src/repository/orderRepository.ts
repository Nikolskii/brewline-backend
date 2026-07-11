import { ObjectId, type Db, type Collection } from 'mongodb';
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

/** Строка → ObjectId. Невалидный hex (кривой id в URL) → null, трактуем как «не найдено». */
function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? ObjectId.createFromHexString(id) : null;
}

export interface OrderRepository {
  /** Активная очередь: статусы new + preparing, по возрастанию createdAt. */
  findActiveQueue(): Promise<Order[]>;
  /** Заказ по id, либо null (нет такого / кривой id). */
  findById(orderId: string): Promise<Order | null>;
  /** Записать новый статус и вернуть обновлённый заказ, либо null (нет такого). */
  updateStatus(orderId: string, status: OrderStatus): Promise<Order | null>;
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

    async findById(orderId: string): Promise<Order | null> {
      const _id = toObjectId(orderId);
      if (!_id) return null;
      const doc = await orders.findOne({ _id });
      return doc ? toDomain(doc) : null;
    },

    async updateStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
      const _id = toObjectId(orderId);
      if (!_id) return null;
      // findOneAndUpdate атомарен и с returnDocument:'after' сразу отдаёт обновлённый документ.
      const doc = await orders.findOneAndUpdate(
        { _id },
        { $set: { status } },
        { returnDocument: 'after' },
      );
      return doc ? toDomain(doc) : null;
    },
  };
}
