# @brewline/api-types

TypeScript-типы контракта [Brewline](https://github.com/Nikolskii) — системы виртуальной очереди для кофейни.

Пакет собирается из OpenAPI-спеки репозитория [brewline-backend](https://github.com/Nikolskii/brewline-backend), которая, в свою очередь, генерируется из zod-схем — единственного описания формы данных в системе (ADR 0010). Теми же схемами backend валидирует входящие запросы, поэтому опубликованные типы отражают то, что сервер действительно принимает и отдаёт. Руками типы не пишутся нигде. Способ доставки зафиксирован в ADR 0009.

## Установка

```bash
npm i -D @brewline/api-types
```

Пакет **types-only**: рантайм-кода в нём нет, поэтому место ему в `devDependencies` — в бандл он не попадает.

## Использование

```ts
import type { Order, OrderStatus } from '@brewline/api-types';

function isReady(order: Order): boolean {
  return order.status === 'ready';
}

const next: OrderStatus = 'preparing';
```

Доменные псевдонимы: `Order`, `OrderStatus`, `OrderItem`, `OrderSource`, `UpdateOrderStatusRequest`.

Если нужны сами эндпоинты (тела запросов, коды ответов), доступны низкоуровневые артефакты генератора:

```ts
import type { paths, operations, components } from '@brewline/api-types';

type OrdersResponse =
  paths['/orders']['get']['responses']['200']['content']['application/json'];
```

Сама спека тоже входит в пакет — на случай, если потребителю нужно сгенерировать себе клиент:

```
node_modules/@brewline/api-types/openapi.yaml
```

## Real-time

Поток `GET /orders/stream` (SSE) не вводит отдельного языка событий: его payload — полный снапшот очереди, то есть `Order[]` (ADR 0001). Тот же тип, что возвращает `GET /orders`.

## Версионирование

SemVer по контракту:

- **major** — несовместимое изменение (удалено поле, сужен enum, изменён тип);
- **minor** — совместимое расширение (новое необязательное поле, новый эндпоинт);
- **patch** — правки описаний и внутренностей пакета.

## Разработка

Пакет живёт внутри `brewline-backend`, рядом со схемами — чтобы контракт и его реализация менялись одним коммитом. Сборка запускается из корня репозитория:

```bash
npm run build:types    # zod-схемы → openapi.yaml → типы → dist/
```

Публикация — GitHub Actions по тегу `api-types-v<версия>`.

## Лицензия

MIT
