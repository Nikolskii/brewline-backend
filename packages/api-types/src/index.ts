import type { components } from './generated/openapi.js';

// Низкоуровневые артефакты генератора — на случай, если потребителю нужны
// сами эндпоинты (тела запросов, коды ответов), а не только доменные типы.
export type { components, operations, paths } from './generated/openapi.js';

// Эргономичные псевдонимы доменных типов: чтобы в коде потребителя не тянулось
// components['schemas']['Order'] по всему файлу. Единственное место, где эти
// имена заданы, — иначе каждый из трёх фронтов писал бы их у себя.
export type Order = components['schemas']['Order'];
export type OrderStatus = components['schemas']['OrderStatus'];
export type OrderItem = components['schemas']['OrderItem'];
export type OrderSource = components['schemas']['OrderSource'];
export type UpdateOrderStatusRequest =
  components['schemas']['UpdateOrderStatusRequest'];
