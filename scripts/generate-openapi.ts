/**
 * Генератор openapi/openapi.yaml из zod-схем (ADR 0010).
 *
 * Живёт ВНЕ src/ намеренно: корневой tsconfig собирает только src, поэтому
 * генератор спеки и yaml-сериализатор остаются devDependencies и не попадают
 * в прод-образ. Плата за это — папке нужен свой scripts/tsconfig.json, иначе
 * файл не принадлежит ни одному проекту и редактор не видит даже @types/node.
 * Запуск: npm run gen:spec (через tsx). Проверка типов: npm run typecheck:scripts.
 *
 * Схемы данных берутся из src/contract/schemas.ts. Здесь описываются только
 * ЭНДПОИНТЫ: пути, коды ответов и та проза, которую невозможно вывести из
 * схем (например, семантика SSE-потока).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { stringify } from 'yaml';

import { z } from 'zod';

import {
  OrderSchema,
  UpdateOrderStatusRequestSchema,
} from '../src/contract/schemas.js';

// Явно регистрировать схемы не нужно: генератор сам выносит в components/schemas
// всё, у чего есть .meta({ id }), включая вложенные (OrderItem, OrderStatus).
// registry.register() здесь неприменим — он требует extendZodWithOpenApi,
// то есть патча прототипа zod, от которого мы отказались.
const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'get',
  path: '/orders',
  operationId: 'getOrders',
  summary: 'Снапшот табло очереди',
  description:
    'Заказы, видимые на табло в зале: статусы new, preparing и ready ' +
    '(ready — «заберите на баре»), упорядоченные по createdAt.',
  responses: {
    200: {
      description: 'Текущая очередь',
      content: {
        'application/json': { schema: OrderSchema.array() },
      },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/orders/{orderId}/status',
  operationId: 'updateOrderStatus',
  summary: 'Сменить статус заказа',
  description:
    'Перевод статуса вперёд по автомату. Недопустимый переход отклоняется (409).',
  request: {
    params: z.object({
      orderId: z.string().describe('Идентификатор заказа.'),
    }),
    body: {
      required: true,
      content: {
        'application/json': { schema: UpdateOrderStatusRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Обновлённый заказ',
      content: { 'application/json': { schema: OrderSchema } },
    },
    400: { description: 'Тело запроса не соответствует контракту' },
    404: { description: 'Заказ не найден' },
    409: { description: 'Недопустимый переход статуса' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/orders/stream',
  operationId: 'streamOrders',
  summary: 'SSE-поток снапшотов очереди',
  description:
    'Server-Sent Events (text/event-stream). При каждом изменении сервер шлёт ' +
    'полный снапшот очереди — JSON-массив Order (ADR 0001). Отдельного языка ' +
    'событий нет: payload переиспользует схему Order. ' +
    'NB: OpenAPI плохо описывает стримы — тело помечено как строка, реальный ' +
    'формат события задан в этом описании.',
  responses: {
    200: {
      description: 'Поток событий',
      content: { 'text/event-stream': { schema: { type: 'string' } } },
    },
  },
});

const document = new OpenApiGeneratorV31(registry.definitions).generateDocument(
  {
    openapi: '3.1.0',
    info: {
      title: 'Brewline API',
      version: '0.1.0',
      description:
        'REST + real-time контракт Brewline.\n' +
        'ФАЙЛ СГЕНЕРИРОВАН из zod-схем (src/contract/schemas.ts, ADR 0010) — ' +
        'править руками бессмысленно, правки затрёт `npm run gen:spec`.\n' +
        'Типы для фронтов собираются отсюда в пакет @brewline/api-types (ADR 0009).',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Локальная разработка' }],
  },
);

// Генератор всегда добавляет эти секции, даже пустыми — в спеке они лишний шум.
if (Object.keys(document.components?.parameters ?? {}).length === 0) {
  delete document.components?.parameters;
}
if (Object.keys(document.webhooks ?? {}).length === 0) {
  delete document.webhooks;
}

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'openapi',
  'openapi.yaml',
);

writeFileSync(outPath, stringify(document, { lineWidth: 100 }), 'utf8');
console.log(`✨ openapi.yaml сгенерирован из zod-схем → ${outPath}`);
