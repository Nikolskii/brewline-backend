/**
 * Конфигурация приложения из переменных окружения.
 * Собираем в одном месте, чтобы остальной код не читал process.env напрямую.
 */
export interface Config {
  port: number;
  /** Строка подключения к MongoDB (включает имя базы, напр. .../brewline). */
  mongoUrl: string;
  /** Сколько миллисекунд заказ `ready` держится на табло, потом авто-снимается. */
  readyTtlMs: number;
  /**
   * Origin'ы фронтов, которым браузер разрешит читать наши ответы (ADR 0004).
   * Список только явный: со звёздочкой браузер запрещает `credentials`, а
   * «отражать любой присланный origin» — это не настройка, а открытая дверь.
   */
  corsOrigins: string[];
}

/** Дев по умолчанию: табло и бариста, каждый на своём порту. */
const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

export function loadConfig(): Config {
  const readyTtlMinutes = Number(process.env.READY_TTL_MINUTES ?? 5);
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port: Number(process.env.PORT ?? 3000),
    mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/brewline',
    readyTtlMs: readyTtlMinutes * 60_000,
    corsOrigins: corsOrigins?.length ? corsOrigins : DEFAULT_CORS_ORIGINS,
  };
}
