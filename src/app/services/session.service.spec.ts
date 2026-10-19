import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('SessionService', () => {
  let sessionStorageMock: MemoryStorage;
  let localStorageMock: MemoryStorage;
  let service: SessionService;

  beforeEach(() => {
    sessionStorageMock = new MemoryStorage();
    localStorageMock = new MemoryStorage();
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorageMock });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock });
    service = new SessionService();
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['workshop_token', false],
    ['workshop_user', false],
    ['workshop_token', true],
    ['workshop_user', true]
  ] as const)('H-11: invalidates session after failed %s write (existing=%s)', (key, existing) => {
    if (existing) service.saveSession('previous-token', { username: 'previous' });
    localStorageMock.setItem('workshop_preferences', 'saved-preferences');
    const failure = new Error('Write denied');
    const originalSet = sessionStorageMock.setItem.bind(sessionStorageMock);
    vi.spyOn(sessionStorageMock, 'setItem').mockImplementation((name, value) => {
      if (name === key) throw failure;
      originalSet(name, value);
    });
    const remove = vi.spyOn(sessionStorageMock, 'removeItem');

    expect(() => service.saveSession('new-token', { username: 'student' })).toThrow(failure);

    expect(remove.mock.calls).toEqual([['workshop_token'], ['workshop_user']]);
    expect(sessionStorageMock.getItem('workshop_token')).toBeNull();
    expect(sessionStorageMock.getItem('workshop_user')).toBeNull();
    expect(localStorageMock.getItem('workshop_preferences')).toBe('saved-preferences');
  });

  it('H-11: serializes before writing and preserves the previous session on serialization failure', () => {
    service.saveSession('previous-token', { username: 'previous' });
    const failure = new Error('Serialization failed');
    const user = { username: 'student', toJSON: () => { throw failure; } };
    const set = vi.spyOn(sessionStorageMock, 'setItem');
    const remove = vi.spyOn(sessionStorageMock, 'removeItem');

    expect(() => service.saveSession('new-token', user)).toThrow(failure);

    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(service.getSession()).toEqual({ token: 'previous-token', user: { username: 'previous' } });
  });

  it.each([
    { denied: ['workshop_token'] },
    { denied: ['workshop_user'] },
    { denied: ['workshop_token', 'workshop_user'] }
  ])('H-11: attempts both rollback removals and preserves causes when denied=$denied', ({ denied }) => {
    const writeFailure = new Error('Write denied');
    const cleanupFailure = new Error('Cleanup denied');
    const originalSet = sessionStorageMock.setItem.bind(sessionStorageMock);
    vi.spyOn(sessionStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === 'workshop_user') throw writeFailure;
      originalSet(key, value);
    });
    const originalRemove = sessionStorageMock.removeItem.bind(sessionStorageMock);
    const remove = vi.spyOn(sessionStorageMock, 'removeItem').mockImplementation((key) => {
      if (denied.includes(key)) throw cleanupFailure;
      originalRemove(key);
    });
    let caught: unknown;
    try {
      service.saveSession('new-token', { username: 'student' });
    } catch (error: unknown) {
      caught = error;
    }

    expect(remove.mock.calls).toEqual([['workshop_token'], ['workshop_user']]);
    expect(caught).toBeInstanceOf(AggregateError);
    if (!(caught instanceof AggregateError)) throw new Error('Expected rollback failure');
    expect(caught.errors).toEqual([writeFailure, ...denied.map(() => cleanupFailure)]);
    expect(caught.message).not.toContain('new-token');
    expect(caught.message).not.toContain('student');
    expect(sessionStorageMock.getItem('workshop_token')).toBe(
      denied.includes('workshop_token') ? 'new-token' : null
    );
    expect(sessionStorageMock.getItem('workshop_user')).toBeNull();
  });

  it('stores and reads authentication data in tab-scoped storage', () => {
    const user = { username: 'student', displayName: 'Student' };

    service.saveSession('token', user);

    expect(sessionStorageMock.getItem('workshop_token')).toBe('token');
    expect(sessionStorageMock.getItem('workshop_user')).toBe(JSON.stringify(user));
    expect(localStorageMock.getItem('workshop_token')).toBeNull();
    expect(service.getSession()).toEqual({ token: 'token', user });
  });

  it('removes legacy session values from persistent storage while preserving preferences', () => {
    localStorageMock.setItem('workshop_token', 'legacy-token');
    localStorageMock.setItem('workshop_user', JSON.stringify({ username: 'student' }));
    localStorageMock.setItem('workshop_preferences', JSON.stringify({ theme: 'dark' }));

    new SessionService();

    expect(localStorageMock.getItem('workshop_token')).toBeNull();
    expect(localStorageMock.getItem('workshop_user')).toBeNull();
    expect(localStorageMock.getItem('workshop_preferences')).toBe(JSON.stringify({ theme: 'dark' }));
  });

  it('clears authentication data without removing persistent preferences', () => {
    localStorageMock.setItem('workshop_preferences', JSON.stringify({ theme: 'dark' }));
    service.saveSession('token', { username: 'student' });

    service.clearSession();

    expect(sessionStorageMock.getItem('workshop_token')).toBeNull();
    expect(sessionStorageMock.getItem('workshop_user')).toBeNull();
    expect(localStorageMock.getItem('workshop_preferences')).toBe(JSON.stringify({ theme: 'dark' }));
  });

  it('merges valid saved preferences with defaults and persists them separately', () => {
    const defaults = { theme: 'light' as const, showTips: true, compact: false };
    localStorageMock.setItem(
      'workshop_preferences',
      JSON.stringify({ theme: 'dark', compact: true })
    );

    expect(service.loadPreferences(defaults)).toEqual({ theme: 'dark', showTips: true, compact: true });
    service.savePreferences({ theme: 'dark', showTips: false, compact: true });
    expect(localStorageMock.getItem('workshop_preferences')).toBe(
      JSON.stringify({ theme: 'dark', showTips: false, compact: true })
    );
  });

  it('clears an invalid serialized session rather than treating it as authenticated', () => {
    sessionStorageMock.setItem('workshop_token', 'token');
    sessionStorageMock.setItem('workshop_user', '{invalid');

    expect(service.getSession()).toBeNull();
    expect(sessionStorageMock.getItem('workshop_token')).toBeNull();
    expect(sessionStorageMock.getItem('workshop_user')).toBeNull();
  });

  it('treats an incomplete session as unauthenticated and clears its partial values', () => {
    sessionStorageMock.setItem('workshop_token', 'token');

    expect(service.getSession()).toBeNull();
    expect(sessionStorageMock.getItem('workshop_token')).toBeNull();
  });

  it('uses default preferences and reports invalid serialized preferences', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const defaults = { theme: 'light', showTips: true, compact: false };
    localStorageMock.setItem('workshop_preferences', '{invalid');

    expect(service.loadPreferences(defaults)).toEqual(defaults);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
