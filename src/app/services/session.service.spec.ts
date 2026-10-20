import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
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

  it('stores only non-sensitive user state in tab-scoped storage', () => {
    const user = { username: 'student', displayName: 'Student' };

    service.saveSession(user);

    expect(sessionStorageMock.getItem('workshop_user')).toBe(JSON.stringify(user));
    expect(sessionStorageMock.getItem('workshop_token')).toBeNull();
    expect(localStorageMock.getItem('workshop_token')).toBeNull();
    expect(service.getSession()).toEqual({ user });
  });

  it('removes legacy token values from both storage locations while preserving preferences', () => {
    sessionStorageMock.setItem('workshop_token', 'legacy-session-value');
    localStorageMock.setItem('workshop_token', 'legacy-session-value');
    localStorageMock.setItem('workshop_preferences', JSON.stringify({ theme: 'dark' }));

    new SessionService();

    expect(sessionStorageMock.getItem('workshop_token')).toBeNull();
    expect(localStorageMock.getItem('workshop_token')).toBeNull();
    expect(localStorageMock.getItem('workshop_preferences')).toBe(JSON.stringify({ theme: 'dark' }));
  });

  it('clears local user state without removing preferences', () => {
    localStorageMock.setItem('workshop_preferences', JSON.stringify({ theme: 'dark' }));
    service.saveSession({ username: 'student' });

    service.clearSession();

    expect(sessionStorageMock.getItem('workshop_user')).toBeNull();
    expect(localStorageMock.getItem('workshop_preferences')).toBe(JSON.stringify({ theme: 'dark' }));
  });

  it('clears malformed or invalid user state instead of treating it as authenticated', () => {
    sessionStorageMock.setItem('workshop_user', '{invalid');

    expect(service.getSession()).toBeNull();
    expect(sessionStorageMock.getItem('workshop_user')).toBeNull();

    sessionStorageMock.setItem('workshop_user', JSON.stringify({ username: 42 }));

    expect(service.getSession()).toBeNull();
    expect(sessionStorageMock.getItem('workshop_user')).toBeNull();
  });

  it('merges valid saved preferences with defaults and persists them separately', () => {
    const defaults = { theme: 'light', showTips: true, compact: false };
    localStorageMock.setItem('workshop_preferences', JSON.stringify({ theme: 'dark', compact: true }));

    expect(service.loadPreferences(defaults)).toEqual({ theme: 'dark', showTips: true, compact: true });
    service.savePreferences({ theme: 'dark', showTips: false, compact: true });
    expect(localStorageMock.getItem('workshop_preferences')).toBe(
      JSON.stringify({ theme: 'dark', showTips: false, compact: true })
    );
  });

  it('uses defaults and reports invalid saved preferences', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const defaults = { theme: 'light', showTips: true, compact: false };
    localStorageMock.setItem('workshop_preferences', '{invalid');

    expect(service.loadPreferences(defaults)).toEqual(defaults);
    expect(warn).toHaveBeenCalledOnce();
  });
});
