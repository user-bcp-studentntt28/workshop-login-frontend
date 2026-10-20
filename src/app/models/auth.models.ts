export interface LoginRequest {
  username: string;
  password: string;
  client: string;
}

export interface AuthenticatedUser {
  username: string;
  displayName?: string | null;
  [property: string]: unknown;
}

export interface LoginResponse {
  user: AuthenticatedUser;
}

export interface AuthSession {
  user: AuthenticatedUser;
}

export interface LoginPreferences {
  theme: string;
  showTips: boolean;
  compact: boolean;
}

export function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  return isRecord(value)
    && typeof value['username'] === 'string'
    && (value['displayName'] === undefined
      || value['displayName'] === null
      || typeof value['displayName'] === 'string');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
