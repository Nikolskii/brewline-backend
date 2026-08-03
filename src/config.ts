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
  /** bcrypt-хеш единого пароля смены. Секрет, никогда не попадает в репозиторий. */
  baristaPasswordHash: string;
  /** Секрет HMAC для подписи идентификатора сессии в cookie. */
  sessionSecret: string;
  /** Сколько миллисекунд действует сессия бариста. */
  sessionTtlMs: number;
  /** Нужен ли атрибут Secure у cookie (в проде — да). */
  secureCookies: boolean;
}

/** Дев по умолчанию: табло и бариста, каждый на своём порту и с обоими loopback-именами. */
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

export function loadConfig(): Config {
  const readyTtlMinutes = Number(process.env.READY_TTL_MINUTES ?? 5);
  const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? 12);
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port: Number(process.env.PORT ?? 3000),
    mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/brewline',
    readyTtlMs: readyTtlMinutes * 60_000,
    corsOrigins: corsOrigins?.length ? corsOrigins : DEFAULT_CORS_ORIGINS,
    baristaPasswordHash: requireEnv('BARISTA_PASSWORD_HASH'),
    sessionSecret: requireEnv('SESSION_SECRET'),
    sessionTtlMs: sessionTtlHours * 60 * 60_000,
    secureCookies: process.env.NODE_ENV === 'production',
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Не задана обязательная переменная окружения ${name}`);
  }

  return value;
}
