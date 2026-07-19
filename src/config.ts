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
}

export function loadConfig(): Config {
  const readyTtlMinutes = Number(process.env.READY_TTL_MINUTES ?? 5);
  return {
    port: Number(process.env.PORT ?? 3000),
    mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/brewline',
    readyTtlMs: readyTtlMinutes * 60_000,
  };
}
