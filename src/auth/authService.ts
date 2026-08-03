import { compare } from 'bcryptjs';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export interface AuthConfig {
  passwordHash: string;
  sessionSecret: string;
  sessionTtlMs: number;
}

export interface AuthService {
  login(password: string): Promise<string | null>;
  hasSession(sessionToken: string | undefined): boolean;
  logout(sessionToken: string | undefined): void;
}

interface Session {
  expiresAt: number;
}

/**
 * Сервер хранит только факт действующей сессии; в cookie лежит случайный
 * идентификатор с HMAC-подписью. JavaScript браузера cookie не читает
 * (httpOnly задаётся HTTP-слоем), а подпись не позволяет подменить id.
 *
 * Хранилище намеренно in-memory: для текущей одной реплики это простая
 * реализация ADR 0011. При горизонтальном масштабировании его заменит Redis
 * или другое общее хранилище без изменения маршрутов.
 */
export function createAuthService(config: AuthConfig): AuthService {
  const sessions = new Map<string, Session>();

  return {
    async login(password) {
      const passwordMatches = await compare(password, config.passwordHash);

      if (!passwordMatches) {
        return null;
      }

      const sessionId = randomUUID();
      sessions.set(sessionId, { expiresAt: Date.now() + config.sessionTtlMs });

      return `${sessionId}.${sign(sessionId, config.sessionSecret)}`;
    },

    hasSession(sessionToken) {
      const sessionId = readSignedSessionId(sessionToken, config.sessionSecret);

      if (!sessionId) {
        return false;
      }

      const session = sessions.get(sessionId);

      if (!session) {
        return false;
      }

      if (session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return false;
      }

      return true;
    },

    logout(sessionToken) {
      const sessionId = readSignedSessionId(sessionToken, config.sessionSecret);

      if (sessionId) {
        sessions.delete(sessionId);
      }
    },
  };
}

function sign(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url');
}

function readSignedSessionId(sessionToken: string | undefined, secret: string): string | null {
  if (!sessionToken) {
    return null;
  }

  const separatorIndex = sessionToken.lastIndexOf('.');

  if (separatorIndex === -1) {
    return null;
  }

  const sessionId = sessionToken.slice(0, separatorIndex);
  const signature = sessionToken.slice(separatorIndex + 1);
  const expectedSignature = sign(sessionId, secret);

  if (signature.length !== expectedSignature.length) {
    return null;
  }

  const isValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  return isValid ? sessionId : null;
}
