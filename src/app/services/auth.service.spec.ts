import '@angular/compiler';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, InvalidLoginResponseError } from './auth.service';
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

describe('AuthService', () => {
  let storage: MemoryStorage;
  let session: SessionService;
  let service: AuthService;

  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
    session = new SessionService();
    service = new AuthService(session);
  });

  afterEach(() => vi.restoreAllMocks());

  it('posts login with credentials and stores only user state, not an authentication token', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { user: { username: 'student' }, expiresIn: 3600 }
    } as AxiosResponse);
    const request = { username: 'student', password: 'Workshop123!', client: 'angular-workshop' };

    await service.authenticate(request);

    expect(post).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8080/auth/login',
      request,
      { timeout: 5000, withCredentials: true }
    );
    expect(session.getSession()).toEqual({ user: { username: 'student' } });
    expect(storage.getItem('workshop_token')).toBeNull();
    expect(storage.getItem('workshop_user')).toBe(JSON.stringify({ username: 'student' }));
  });

  it('rejects a login response that exposes an authentication token', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: 'unexpected', user: { username: 'student' } }
    } as AxiosResponse);

    await expect(service.authenticate({
      username: 'student',
      password: 'Workshop123!',
      client: 'angular-workshop'
    })).rejects.toBeInstanceOf(InvalidLoginResponseError);
    expect(session.getSession()).toBeNull();
  });

  it('rejects responses with a user missing the required username', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { user: { displayName: 'Student' } }
    } as AxiosResponse);

    await expect(service.authenticate({
      username: 'student',
      password: 'Workshop123!',
      client: 'angular-workshop'
    })).rejects.toBeInstanceOf(InvalidLoginResponseError);
    expect(session.getSession()).toBeNull();
  });

  it('logs out through the cookie endpoint and clears local user state', async () => {
    session.saveSession({ username: 'student' });
    const post = vi.spyOn(axios, 'post').mockResolvedValue({} as AxiosResponse);

    await service.logout();

    expect(post).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8080/auth/logout',
      null,
      { withCredentials: true }
    );
    expect(session.getSession()).toBeNull();
  });

  it('preserves local session state when the server cannot clear the cookie', async () => {
    session.saveSession({ username: 'student' });
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network unavailable'));

    await expect(service.logout()).rejects.toThrow('Network unavailable');
    expect(session.getSession()).toEqual({ user: { username: 'student' } });
  });
});
