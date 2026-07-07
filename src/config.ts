/**
 * Конфигурация приложения из переменных окружения.
 * Собираем в одном месте, чтобы остальной код не читал process.env напрямую.
 */
export interface Config {
  port: number;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
  };
}
