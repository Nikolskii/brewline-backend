# brewline-backend

> **Ядро Brewline** — REST API и real-time поток статусов заказов для системы виртуальной очереди кофейни.

![status](https://img.shields.io/badge/status-work_in_progress-yellow)
![stack](https://img.shields.io/badge/Node.js-Express-3178C6)
![lang](https://img.shields.io/badge/TypeScript-strict-3178C6)

## Что такое Brewline

Виртуальная очередь для кофейни: заказы из кассы и веб-формы попадают в единую цифровую очередь.
Бариста меняют статусы напитков, а клиенты и экран в зале видят изменения **мгновенно, во всех местах сразу** —
без «мой кофе готов?» и хаоса в час пик.

> Это учебный / портфолио-проект. Ценность здесь — **инженерный процесс** (анализ → C4/BPMN → ADR →
> Agile-декомпозиция → multi-repo → CI/CD → k3s), а не «коробочный продукт для кофеен».

## Роль этого репозитория

Центральный сервис системы — держит очередь и рассылает изменения статусов. Ключевые инженерные решения:

- **Один источник истины на валидацию, типы и спеку.** Форма данных описана схемами `zod` в коде;
  из них выводятся рантайм-валидация входящих запросов, TypeScript-типы и сама OpenAPI-спека.
  Разойтись между собой им физически негде. *(ADR 0010)*
- **Real-time через SSE-снапшоты.** Сервер шлёт актуальное состояние очереди по Server-Sent Events;
  payload переиспользует доменный тип `Order` из той же OpenAPI. *(ADR 0001)*
- **Автомат статусов заказа** — переходы статусов заданы явными правилами, а не «как получится».

## Стек

`Node.js` · `Express` · `TypeScript (strict)` · `MongoDB`

## API (инкремент 1 — walking skeleton)

| Метод | Путь              | Назначение                        |
|-------|-------------------|-----------------------------------|
| GET   | `/health`         | Проверка живости сервиса ✅        |
| GET   | `/orders`         | Снапшот активной очереди (`new` + `preparing`, по `createdAt`) ✅ |
| PATCH | `/orders/{id}/status` | Перевод заказа по автомату статусов (`409` — недопустимый переход) ✅ |
| GET   | `/orders/stream`  | SSE-поток снапшотов (real-time, событие `snapshot`) ✅ |

Контракт описан zod-схемами в [`src/contract/schemas.ts`](src/contract/schemas.ts) (ADR 0010).
Из них генерируется [`openapi/openapi.yaml`](openapi/openapi.yaml) — публикуемый артефакт и вход
для npm-пакета [`@brewline/api-types`](packages/api-types), которым питаются фронты (ADR 0009).
Вендорных копий контракта в репозиториях фронтов нет.

```
zod-схемы  →  openapi.yaml  →  @brewline/api-types  →  фронты
     └─→ валидация входящих запросов + типы backend
```

| Команда | Что делает |
|---------|-----------|
| `npm run gen:spec` | Перегенерировать `openapi.yaml` из схем |
| `npm run check:spec` | Проверить, что закоммиченная спека не отстала (запускается в CI) |
| `npm run build:types` | Собрать пакет `@brewline/api-types` |
| `npm run typecheck:scripts` | Проверить типы в `scripts/` (в сборку приложения они не входят) |

## Запуск

**Вариант A — через docker-compose (рекомендуется).** Backend + MongoDB одной командой,
с hot-reload. `docker-compose.yml` живёт в этом же репо:
```bash
docker compose up --build     # первый раз — со сборкой; далее просто docker compose up
```
> Меняли зависимости (`package.json`)? Пересоберите с пересозданием анонимных томов:
> `docker compose up -d --build -V` (том `node_modules` иначе перекроет свежий образ).

**Вариант B — автономно на хосте.** Нужен Node 22+ и запущенная MongoDB.
```bash
npm install
npm run dev      # tsx watch, hot-reload (по умолчанию порт 3000)
```

**Прод-сборка:**
```bash
npm run build    # TS → dist/
npm start        # node dist/index.js
```

**Скрипты:**

| Скрипт           | Что делает                        |
|------------------|-----------------------------------|
| `npm run dev`    | Dev-сервер с hot-reload (tsx)     |
| `npm run seed`   | Засеять тестовые заказы в Mongo (стирающий) |
| `npm run build`  | Компиляция TypeScript в `dist/`   |
| `npm start`      | Запуск собранного сервера         |
| `npm run lint`   | ESLint                            |
| `npm run format` | Prettier (форматирование)         |

**Конфигурация** (переменные окружения):

| Переменная           | По умолчанию | Назначение          |
|----------------------|--------------|---------------------|
| `PORT`               | `3000`       | Порт HTTP-сервера   |
| `MONGO_URL`          | —            | Строка подключения к MongoDB |
| `READY_TTL_MINUTES`  | `5`          | Сколько минут `ready` держится на табло, потом авто-снимается |

## Ручная проверка

Стек поднят (backend `:3000` + Mongo), см. [Запуск](#запуск).

**1. Живость и очередь** (браузер или curl):
```bash
curl http://localhost:3000/health     # {"status":"ok"}
```
Открыть в браузере `http://localhost:3000/orders` — 4 заказа (`ready` скрыт, он не в очереди).

**2. Засеять тестовые данные:**
```bash
docker compose exec backend npm run seed
```

**3. Live-обновление через SSE — нужны два терминала.**

Терминал A — подписка на поток (висит и печатает события):
```bash
curl -N http://localhost:3000/orders/stream
```
Сразу придёт `event: snapshot` с текущей очередью.

Терминал B — сменить статус. Взять `orderId` со страницы `/orders`, затем:
```bash
curl -X PATCH http://localhost:3000/orders/<orderId>/status \
  -H 'Content-Type: application/json' -d '{"status":"preparing"}'
```
→ В терминале A **тут же появится новый `snapshot`** с обновлённым статусом. Это и есть live-очередь.

**4. Проверка отказов:**
```bash
# назад нельзя → 409
curl -i -X PATCH http://localhost:3000/orders/<orderId>/status \
  -H 'Content-Type: application/json' -d '{"status":"new"}'
# кривой статус → 400 ; несуществующий id → 404
```

## Экосистема репозиториев

| Репо | Роль |
|------|------|
| **brewline-backend** ← вы здесь | API + real-time |
| [brewline-display](https://github.com/Nikolskii/brewline-display) | Экран очереди в зале |
| [brewline-infra](https://github.com/Nikolskii/brewline-infra) | Общая инфраструктура (MongoDB, деплой) |

## Статус

🚧 В активной разработке. Текущий срез — **живая очередь локально** (смена статуса → экран обновляется live через SSE, end-to-end).
