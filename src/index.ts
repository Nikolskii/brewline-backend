import { MongoClient } from 'mongodb';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createOrderRepository } from './repository/orderRepository.js';

const config = loadConfig();

// Подключаемся к Mongo ОДИН раз при старте: соединение дорогое, драйвер сам
// держит пул. Если база недоступна — падаем сразу, а не при первом запросе.
const client = new MongoClient(config.mongoUrl);
await client.connect();

// Имя базы берётся из строки подключения (.../brewline).
const db = client.db();
const repository = createOrderRepository(db);

const app = createApp(repository);

const server = app.listen(config.port, () => {
  console.log(`Brewline backend listening on http://localhost:${config.port}`);
});

// Корректное завершение: не рвём соединения на полуслове.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void client.close().then(() => process.exit(0));
    });
  });
}
