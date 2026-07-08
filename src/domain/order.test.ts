import { describe, it, expect } from 'vitest';
import { canTransition, isActiveStatus } from './order.js';

describe('canTransition — автомат статусов', () => {
  it('разрешает переходы вперёд по одному шагу', () => {
    expect(canTransition('new', 'preparing')).toBe(true);
    expect(canTransition('preparing', 'ready')).toBe(true);
  });

  it('запрещает скачок через статус (new → ready)', () => {
    expect(canTransition('new', 'ready')).toBe(false);
  });

  it('запрещает переход назад', () => {
    expect(canTransition('preparing', 'new')).toBe(false);
    expect(canTransition('ready', 'preparing')).toBe(false);
  });

  it('из терминального ready переходов нет', () => {
    expect(canTransition('ready', 'new')).toBe(false);
    expect(canTransition('ready', 'preparing')).toBe(false);
  });

  it('переход в тот же статус запрещён', () => {
    expect(canTransition('new', 'new')).toBe(false);
  });
});

describe('isActiveStatus — членство в активной очереди', () => {
  it('new и preparing — активны', () => {
    expect(isActiveStatus('new')).toBe(true);
    expect(isActiveStatus('preparing')).toBe(true);
  });

  it('ready — не в очереди (закрыт)', () => {
    expect(isActiveStatus('ready')).toBe(false);
  });
});
