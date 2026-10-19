import axios from 'axios';

export type ApiOperation = 'login' | 'tasks';

export function toUserFacingError(error: unknown, operation: ApiOperation): string {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;

  if (operation === 'login') {
    return status === 401
      ? 'Usuario o contraseña incorrectos.'
      : 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }

  return status === 401 || status === 403
    ? 'Tu sesión no es válida. Inicia sesión de nuevo.'
    : 'No se pudieron cargar las tareas. Inténtalo de nuevo.';
}
