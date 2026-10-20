import { Injectable } from '@angular/core';
import {
  AuthSession,
  AuthenticatedUser,
  isAuthenticatedUser,
  isRecord,
  LoginPreferences
} from '../models/auth.models';

const SESSION_USER_KEY = 'workshop_user';
const LEGACY_SESSION_TOKEN_KEY = 'workshop_token';
const PREFERENCES_KEY = 'workshop_preferences';

@Injectable({ providedIn: 'root' })
export class SessionService {
  constructor() {
    try {
      sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
    } catch (error) {
      console.warn('Legacy session could not be cleared from tab storage', error);
    }
    try {
      localStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
    } catch (error) {
      console.warn('Legacy session could not be cleared from persistent storage', error);
    }
  }

  saveSession(user: AuthenticatedUser): void {
    const serializedUser = JSON.stringify(user);
    sessionStorage.setItem(SESSION_USER_KEY, serializedUser);
  }

  getSession(): AuthSession | null {
    const serializedUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (!serializedUser) {
      this.clearSession();
      return null;
    }

    try {
      const user: unknown = JSON.parse(serializedUser);
      if (isAuthenticatedUser(user)) {
        return { user };
      }
    } catch {
      this.clearSession();
      return null;
    }

    this.clearSession();
    return null;
  }

  clearSession(): void {
    sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
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
