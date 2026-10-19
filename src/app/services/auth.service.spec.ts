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

  it('H-11: propagates persistence failure and removes partial session without changing the POST', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: 'token', user: { username: 'student' } }
    } as AxiosResponse);
    const failure = new Error('Write denied');
    const originalSet = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === 'workshop_user') throw failure;
      originalSet(key, value);
    });
    const request = { username: 'student', password: 'Workshop123!', client: 'angular-workshop' };

    await expect(service.authenticate(request)).rejects.toBe(failure);

    expect(post).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8080/auth/login', request, { timeout: 5000 }
    );
    expect(storage.getItem('workshop_token')).toBeNull();
    expect(storage.getItem('workshop_user')).toBeNull();
  });

  it('preserves the login endpoint, body, timeout, and stores a valid session', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: 'token', user: { username: 'student' } }
    } as AxiosResponse);

    await service.authenticate({
      username: 'student',
      password: 'Workshop123!',
      client: 'angular-workshop'
    });

    expect(post).toHaveBeenCalledWith(
      'http://localhost:8080/auth/login',
      { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
      { timeout: 5000 }
    );
    expect(session.getSession()).toEqual({ token: 'token', user: { username: 'student' } });
  });

  it('rejects a response without a usable token or user', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: '', user: { username: 'student' } }
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
      data: { token: 'token', user: { displayName: 'Student' } }
    } as AxiosResponse);

    await expect(service.authenticate({
      username: 'student',
      password: 'Workshop123!',
      client: 'angular-workshop'
    })).rejects.toBeInstanceOf(InvalidLoginResponseError);
    expect(session.getSession()).toBeNull();
  });
});
