import { describe, expect, it } from 'vitest';
import { toUserFacingError } from './api-error';

describe('toUserFacingError', () => {
  it('returns a consistent login message without backend details', () => {
    const error = { isAxiosError: true, response: { status: 500, data: { message: 'secret detail' } } };

    expect(toUserFacingError(error, 'login')).toBe('No se pudo iniciar sesión. Inténtalo de nuevo.');
    expect(toUserFacingError(error, 'login')).not.toContain('secret detail');
  });

  it('returns a session message for unauthorized task requests', () => {
    const error = { isAxiosError: true, response: { status: 401, data: { detail: 'internal detail' } } };

    expect(toUserFacingError(error, 'tasks')).toBe('Tu sesión no es válida. Inicia sesión de nuevo.');
    expect(toUserFacingError(error, 'tasks')).not.toContain('internal detail');
  });

  it('classifies unauthorized login without exposing backend data', () => {
    const error = { isAxiosError: true, response: { status: 401, data: { message: 'private' } } };

    expect(toUserFacingError(error, 'login')).toBe('Usuario o contraseña incorrectos.');
  });

  it('uses a safe generic message for unknown errors', () => {
    expect(toUserFacingError(new Error('internal detail'), 'tasks')).toBe(
      'No se pudieron cargar las tareas. Inténtalo de nuevo.'
    );
  });
});
