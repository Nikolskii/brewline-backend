# syntax=docker/dockerfile:1

# ============================================================
#  base — общая основа для всех стадий
# ============================================================
FROM node:22-alpine AS base
WORKDIR /app

# ============================================================
#  deps — установка ВСЕХ зависимостей (dev + prod)
#  Копируем только манифесты → слой кешируется, пока
#  package*.json не изменились (правка кода его не сбрасывает).
#  npm ci — детерминированная установка строго из lock-файла.
# ============================================================
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ============================================================
#  build — компиляция TypeScript → JavaScript (нужны devDeps)
# ============================================================
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ============================================================
#  dev — цель для локальной разработки.
#  Код НЕ копируем: docker-compose примонтирует его с хоста
#  (bind-mount), а tsx watch будет ловить изменения (hot-reload).
# ============================================================
FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ============================================================
#  prod — лёгкий финальный образ.
#  Переиспользуем node_modules из deps (сеть уже отработала там)
#  и вырезаем devDependencies через npm prune — локально, без сети.
#  Копируем только готовый dist. Ни исходников TS, ни devDeps.
# ============================================================
FROM base AS prod
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
