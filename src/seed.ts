import { MongoClient } from 'mongodb';
import { loadConfig } from './config.js';
import type { OrderItem, OrderSource, OrderStatus } from './domain/order.js';

/**
 * Dev-утилита (задача I8): кладёт тестовые заказы в Mongo.
 * Создание заказов из кассы/веб-формы — вне скоупа инкремента 1, поэтому данные
 * для демо появляются через этот сидинг.
 *
 * Запуск:  npm run seed   (нужна поднятая Mongo, напр. через docker compose)
 * ВНИМАНИЕ: стирающий сидинг — очищает коллекцию orders перед вставкой.
 */

/** Форма вставляемого документа: без _id (его генерит Mongo). */
interface SeedOrder {
  number: number;
  items: OrderItem[];
  source: OrderSource;
  status: OrderStatus;
  createdAt: Date;
}

const minutesAgo = (m: number): Date => new Date(Date.now() - m * 60_000);

const SEED_ORDERS: SeedOrder[] = [
  {
    number: 101,
    items: [{ name: 'Латте', quantity: 1 }],
    source: 'cashier',
    status: 'new',
    createdAt: minutesAgo(8),
  },
  {
    number: 103,
    items: [{ name: 'Флэт уайт', quantity: 1 }],
    source: 'cashier',
    status: 'preparing',
    createdAt: minutesAgo(6),
  },
  {
    number: 102,
    items: [{ name: 'Капучино', quantity: 2 }],
    source: 'web',
    status: 'new',
    createdAt: minutesAgo(5),
  },
  {
    number: 105,
    items: [{ name: 'Раф', quantity: 1 }],
    source: 'web',
    status: 'new',
    createdAt: minutesAgo(2),
  },
  // ready — закрыт, в активную очередь не входит (проверка фильтра).
  {
    number: 104,
    items: [{ name: 'Эспрессо', quantity: 1 }],
    source: 'cashier',
    status: 'ready',
    createdAt: minutesAgo(12),
  },
];

const config = loadConfig();
const client = new MongoClient(config.mongoUrl);
await client.connect();

const orders = client.db().collection('orders');
await orders.deleteMany({});
await orders.insertMany(SEED_ORDERS);

console.log(
  `Засеяно заказов: ${SEED_ORDERS.length} (в активной очереди — 4, ready — 1 вне очереди)`,
);

await client.close();
