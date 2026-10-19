import { beforeEach, describe, expect, it, vi } from 'vitest';
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
