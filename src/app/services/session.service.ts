import { Injectable } from '@angular/core';
import {
  AuthSession,
  AuthenticatedUser,
  isAuthenticatedUser,
  isRecord,
  LoginPreferences
} from '../models/auth.models';

const SESSION_TOKEN_KEY = 'workshop_token';
const SESSION_USER_KEY = 'workshop_user';
const PREFERENCES_KEY = 'workshop_preferences';

@Injectable({ providedIn: 'root' })
export class SessionService {
  constructor() {
    try {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
    } catch (error) {
      console.warn('Legacy session could not be cleared', error);
    }
  }

  saveSession(token: string, user: AuthenticatedUser): void {
    const serializedUser = JSON.stringify(user);
    try {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_USER_KEY, serializedUser);
    } catch (error: unknown) {
      this.rollbackSession(error);
    }
  }

  private rollbackSession(writeError: unknown): never {
    const errors: unknown[] = [writeError];
    for (const key of [SESSION_TOKEN_KEY, SESSION_USER_KEY]) {
      try {
        sessionStorage.removeItem(key);
      } catch (cleanupError: unknown) {
        errors.push(cleanupError);
      }
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Session could not be saved or fully cleared');
    }
    throw writeError;
  }

  getSession(): AuthSession | null {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const serializedUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (!token || !serializedUser) {
      this.clearSession();
      return null;
    }

    try {
      const user: unknown = JSON.parse(serializedUser);
      if (isAuthenticatedUser(user)) {
        return { token, user };
      }
    } catch {
      this.clearSession();
      return null;
    }

    this.clearSession();
    return null;
  }

  clearSession(): void {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  }

  loadPreferences(defaults: LoginPreferences): LoginPreferences {
    const serializedPreferences = localStorage.getItem(PREFERENCES_KEY);
    if (!serializedPreferences) {
      return { ...defaults };
    }

    try {
      const saved: unknown = JSON.parse(serializedPreferences);
      if (!isRecord(saved)) {
        throw new Error('Saved preferences are not an object');
      }
      return {
        theme: typeof saved['theme'] === 'string' ? saved['theme'] : defaults.theme,
        showTips: typeof saved['showTips'] === 'boolean' ? saved['showTips'] : defaults.showTips,
        compact: typeof saved['compact'] === 'boolean' ? saved['compact'] : defaults.compact
      };
    } catch (error) {
      console.warn('Preferences could not be loaded', error);
      return { ...defaults };
    }
  }

  savePreferences(preferences: LoginPreferences): void {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }
}
