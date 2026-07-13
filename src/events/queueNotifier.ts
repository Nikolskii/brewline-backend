import { EventEmitter } from 'node:events';

/**
 * Тонкая обёртка над EventEmitter: канал «очередь изменилась».
 * Развязывает слои — сервис публикует событие, не зная про SSE/HTTP,
 * а SSE-хаб подписывается, не зная про смену статуса.
 */
export interface QueueNotifier {
  /** Сообщить, что очередь изменилась. */
  emitChange(): void;
  /** Подписаться на изменения очереди. */
  onChange(listener: () => void): void;
}

export function createQueueNotifier(): QueueNotifier {
  const emitter = new EventEmitter();
  return {
    emitChange() {
      emitter.emit('change');
    },
    onChange(listener) {
      emitter.on('change', listener);
    },
  };
}
