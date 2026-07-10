/**
 * Конфигурация приложения из переменных окружения.
 * Собираем в одном месте, чтобы остальной код не читал process.env напрямую.
 */
export interface Config {
  port: number;
  /** Строка подключения к MongoDB (включает имя базы, напр. .../brewline). */
  mongoUrl: string;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
    mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/brewline',
  };
}
