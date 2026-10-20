import '@angular/compiler';
import { ChangeDetectorRef, Injector, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios, { AxiosError, AxiosHeaders, AxiosResponse, CanceledError } from 'axios';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { LoginComponent } from './login.component';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function response(data: unknown, status = 200): AxiosResponse<unknown> {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config: { headers: new AxiosHeaders() }
  };
}

function httpError(status: number): AxiosError {
  const result = response({ message: 'Internal detail', detail: 'Internal detail' }, status);
  return new AxiosError('Internal detail', 'ERR_BAD_RESPONSE', result.config, undefined, result);
}

const validLogin = { user: { username: 'student', displayName: 'Student' } };
const loginError = 'No se pudo iniciar sesión. Inténtalo de nuevo.';
const tasksError = 'No se pudieron cargar las tareas. Inténtalo de nuevo.';
const transportErrors = [
  ['backend caído', new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED')],
  ['red / CORS', new AxiosError('Network Error', 'ERR_NETWORK')],
  ['cancelación', new CanceledError('Canceled')]
] as const;

describe('Login and tasks flow with real services', () => {
  let persistentStorage: MemoryStorage;
  let tabStorage: MemoryStorage;
  let session: SessionService;
  let login: LoginComponent;
  let dashboard: DashboardComponent;
  let navigate: ReturnType<typeof vi.fn<Router['navigate']>>;

  beforeEach(() => {
    persistentStorage = new MemoryStorage();
    tabStorage = new MemoryStorage();
    vi.stubGlobal('localStorage', persistentStorage);
    vi.stubGlobal('sessionStorage', tabStorage);
    navigate = vi.fn<Router['navigate']>().mockResolvedValue(true);
    const injector = Injector.create({
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } },
        { provide: NgZone, useValue: { run: (callback: () => void) => callback() } }
      ]
    });
    session = new SessionService();
    const router = injector.get(Router);
    const authService = new AuthService(session);
    login = new LoginComponent(authService, session, router);
    login.username = 'student';
    login.password = 'Workshop123!';
    dashboard = new DashboardComponent(
      router,
      injector.get(ChangeDetectorRef),
      injector.get(NgZone),
      session,
      new TasksService(),
      authService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('logs in, loads tasks, and logs out through real components and services', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue(response(validLogin));
    const get = vi.spyOn(axios, 'get').mockResolvedValue(response([
      { title: 'Visible', status: 'TODO', priority: 2, owner: 'student' },
      { title: 'Hidden', status: 'ARCHIVED', priority: 1, owner: 'student' }
    ]));

    await login.login();
    await dashboard.ngOnInit();

    expect(post).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8080/auth/login',
      { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
      { timeout: 5000, withCredentials: true }
    );
    expect(get).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8000/api/tasks?owner=student',
      { withCredentials: true }
    );
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(login.busy).toBe(false);
    expect(dashboard.loading).toBe(false);
    expect(dashboard.error).toBe('');
    expect(dashboard.visibleTasks).toEqual([
      { title: 'Visible', status: 'TODO', priority: 2, owner: 'student', label: '2 · STUDENT' }
    ]);

    await dashboard.logout();

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(
      'http://localhost:8080/auth/logout',
      null,
      { withCredentials: true }
    );
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(
      'http://localhost:8080/auth/logout',
      null,
      { withCredentials: true }
    );
    expect(session.getSession()).toBeNull();
    expect(persistentStorage.getItem('workshop_preferences')).not.toBeNull();
    expect(navigate).toHaveBeenLastCalledWith(['/login']);
  });

  it.each([
    ['', 'Workshop123!', 'Ingrese un usuario.'],
    ['   ', 'Workshop123!', 'Ingrese un usuario.'],
    ['student', '', 'Ingrese una contraseña.'],
    ['student', '   ', 'Ingrese una contraseña.']
  ])('rejects blank input username=%j password=%j', async (username, password, message) => {
    const post = vi.spyOn(axios, 'post');
    login.username = username;
    login.password = password;

    await login.login();

    expect(post).not.toHaveBeenCalled();
    expect(login.message).toBe(message);
    expect(login.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 422, 500, 503])('handles login HTTP %i without exposing details', async (status) => {
    const post = vi.spyOn(axios, 'post').mockRejectedValue(httpError(status));

    await login.login();

    expect(login.message).toBe(status === 401 ? 'Usuario o contraseña incorrectos.' : loginError);
    expect(login.busy).toBe(false);
    expect(session.getSession()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledOnce();
  });

  it.each(transportErrors)('handles login transport failure: %s', async (_name, error) => {
    const post = vi.spyOn(axios, 'post').mockRejectedValue(error);

    await login.login();

    expect(login.message).toBe(loginError);
    expect(login.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledOnce();
  });

  it('enforces the actual 5000 ms login timeout with the Axios HTTP adapter', async () => {
    const server = createServer(() => {
      // Deliberately leave the request unanswered to exercise the real timeout.
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected a loopback TCP address');
    }
    const interceptor = axios.interceptors.request.use((config) => {
      expect(config.url).toBe('http://localhost:8080/auth/login');
      expect(config.timeout).toBe(5000);
      config.url = `http://127.0.0.1:${address.port}/auth/login`;
      config.adapter = 'http';
      config.proxy = false;
      return config;
    });
    let failure: unknown;
    const errorObserver = axios.interceptors.response.use(undefined, (error: unknown) => {
      failure = error;
      return Promise.reject(error);
    });
    try {
      const pending = login.login();
      expect(login.busy).toBe(true);
      await pending;

      expect(axios.isAxiosError(failure)).toBe(true);
      if (!axios.isAxiosError(failure)) {
        throw new Error('Expected an Axios timeout error');
      }
      expect(failure.code).toBe('ECONNABORTED');
      expect(failure.message).toContain('timeout of 5000ms exceeded');
      expect(login.message).toBe(loginError);
      expect(login.busy).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      axios.interceptors.request.eject(interceptor);
      axios.interceptors.response.eject(errorObserver);
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  }, 12000);

  it.each([
    undefined, null, [], 'not JSON',
    {},
    { token: '', user: validLogin.user },
    { token: 42, user: validLogin.user },
    { token: 'token', user: null },
    { token: 'token', user: { username: 42 } },
    { token: 'token', user: { username: 'student', displayName: 42 } }
  ].map((data) => ({ data })))('rejects unexpected successful login data: $data', async ({ data }) => {
    vi.spyOn(axios, 'post').mockResolvedValue(response(data));

    await login.login();

    expect(login.message).toBe('El backend respondió sin una sesión válida.');
    expect(login.busy).toBe(false);
    expect(session.getSession()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['workshop_user', 'workshop_preferences'])(
    'shows a safe error if writing %s fails',
    async (key) => {
      vi.spyOn(axios, 'post').mockResolvedValue(response(validLogin));
      const storage = key === 'workshop_preferences' ? persistentStorage : tabStorage;
      const originalSet = storage.setItem.bind(storage);
      vi.spyOn(storage, 'setItem').mockImplementation((name, value) => {
        if (name === key) {
          throw new DOMException('Storage denied', 'QuotaExceededError');
        }
        originalSet(name, value);
      });

      await login.login();

      expect(login.message).toBe(loginError);
      expect(login.busy).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    }
  );

  it('shows a safe login error when navigation rejects', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue(response(validLogin));
    navigate.mockRejectedValue(new Error('Navigation failed'));

    await login.login();

    expect(login.message).toBe(loginError);
    expect(login.busy).toBe(false);
  });

  it.each([400, 401, 403, 404, 422, 500, 503])(
    'handles tasks HTTP %i without showing backend details',
    async (status) => {
      session.saveSession(validLogin.user);
      const get = vi.spyOn(axios, 'get').mockRejectedValue(httpError(status));

      await dashboard.ngOnInit();

      expect(dashboard.error).toBe(
        status === 401 || status === 403
          ? 'Tu sesión no es válida. Inicia sesión de nuevo.'
          : tasksError
      );
      expect(dashboard.loading).toBe(false);
      expect(dashboard.visibleTasks).toEqual([]);
      expect(get).toHaveBeenCalledOnce();
      expect(navigate).not.toHaveBeenCalled();
    }
  );

  it.each(transportErrors)('handles tasks transport failure: %s', async (_name, error) => {
    session.saveSession(validLogin.user);
    const get = vi.spyOn(axios, 'get').mockRejectedValue(error);

    await dashboard.ngOnInit();

    expect(dashboard.error).toBe(tasksError);
    expect(dashboard.loading).toBe(false);
    expect(get).toHaveBeenCalledOnce();
  });

  it('keeps loading while tasks are pending and handles a later transport timeout', async () => {
    session.saveSession(validLogin.user);
    let rejectRequest: (reason: unknown) => void = () => {
      throw new Error('The pending request has not been created');
    };
    const get = vi.spyOn(axios, 'get').mockImplementation(() => new Promise((_resolve, reject) => {
      rejectRequest = reject;
    }));
    const pending = dashboard.ngOnInit();

    expect(dashboard.loading).toBe(true);
    expect(dashboard.error).toBe('');
    expect(get).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8000/api/tasks?owner=student',
      { withCredentials: true }
    );
    rejectRequest(new AxiosError('Transport timed out', 'ETIMEDOUT'));
    await pending;

    expect(dashboard.loading).toBe(false);
    expect(dashboard.error).toBe(tasksError);
  });

  it.each([
    undefined, null, '', 'not JSON', { tasks: [] }, [null],
    [{ status: 3 }], [{ priority: {} }], [{ owner: [] }],
    [{ title: 3 }], [{ description: false }],
    [{ title: 'Valid', status: 'TODO' }, { status: false }]
  ].map((data) => ({ data })))('rejects unexpected successful tasks data without a partial list: $data', async ({ data }) => {
    session.saveSession(validLogin.user);
    vi.spyOn(axios, 'get').mockResolvedValue(response(data));

    await dashboard.ngOnInit();

    expect(dashboard.error).toBe(tasksError);
    expect(dashboard.loading).toBe(false);
    expect(dashboard.tasks).toEqual([]);
    expect(dashboard.visibleTasks).toEqual([]);
  });

  it.each([[], [{ title: 'Archived', status: 'ARCHIVED' }]].map((data) => ({ data })))(
    'allows an empty visible tasks list: $data',
    async ({ data }) => {
      session.saveSession(validLogin.user);
      vi.spyOn(axios, 'get').mockResolvedValue(response(data));

      await dashboard.ngOnInit();

      expect(dashboard.visibleTasks).toEqual([]);
      expect(dashboard.loading).toBe(false);
      expect(dashboard.error).toBe('');
    }
  );

  it('accepts optional/null task fields and keeps equal priorities stable', async () => {
    session.saveSession(validLogin.user);
    vi.spyOn(axios, 'get').mockResolvedValue(response([
      {},
      { status: null, title: null, description: null, priority: null, owner: null },
      { title: 'First', priority: 1 },
      { title: 'Second', priority: 1 }
    ]));

    await dashboard.ngOnInit();

    expect(dashboard.error).toBe('');
    expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['First', 'Second', undefined, null]);
    expect(dashboard.visibleTasks[2]?.label).toBe('NORMAL · SIN-ASIGNAR');
  });

  it('uses preference defaults for fields with invalid types', () => {
    persistentStorage.setItem('workshop_preferences', JSON.stringify({
      theme: false, showTips: 'no', compact: 'yes'
    }));

    expect(session.loadPreferences({ theme: 'light', showTips: true, compact: false }))
      .toEqual({ theme: 'light', showTips: true, compact: false });
  });

  it('reports invalid preference roots and falls back to defaults', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    persistentStorage.setItem('workshop_preferences', '[]');

    expect(session.loadPreferences({ theme: 'light', showTips: true, compact: false }))
      .toEqual({ theme: 'light', showTips: true, compact: false });
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Preferences could not be loaded', expect.any(Error)
    );
  });

  it('warns if legacy storage cleanup is denied', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failure = new DOMException('Storage denied', 'SecurityError');
    vi.spyOn(persistentStorage, 'removeItem').mockImplementation(() => { throw failure; });

    new SessionService();

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Legacy session could not be cleared from persistent storage', failure
    );
  });

  it.each([
    null,
    '{invalid',
    'null',
    JSON.stringify({ username: 3 })
  ])('redirects without fetching tasks for invalid stored user state %j', async (user) => {
    if (user !== null) tabStorage.setItem('workshop_user', user);
    const get = vi.spyOn(axios, 'get');

    await dashboard.ngOnInit();

    expect(get).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
    expect(tabStorage.getItem('workshop_token')).toBeNull();
    expect(tabStorage.getItem('workshop_user')).toBeNull();
  });

  it.each(['TODO', 'IN_PROGRESS', 'DONE', 'RESUELTO', 'COMPLETED'])(
    'presents documented status %s',
    (status) => {
      const labels: Record<string, string> = {
        TODO: 'Por hacer',
        IN_PROGRESS: 'En progreso',
        DONE: 'Completado',
        RESUELTO: 'Resuelto',
        COMPLETED: 'Completado'
      };
      expect(dashboard.statusLabel(status)).toBe(labels[status]);
      expect(dashboard.statusLabel(status.toLowerCase())).toBe(labels[status]);
    }
  );

  describe('Approved corrections H-09, H-10, H-11', () => {
    it('H-09: controls a read error for user state', async () => {
      const failure = new DOMException('Storage denied', 'SecurityError');
      const get = vi.spyOn(axios, 'get');
      const originalGet = tabStorage.getItem.bind(tabStorage);
      vi.spyOn(tabStorage, 'getItem').mockImplementation((name) => {
        if (name === 'workshop_user') throw failure;
        return originalGet(name);
      });

      await expect(dashboard.ngOnInit()).resolves.toBeUndefined();
      expect(get).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(dashboard.loading).toBe(false);
      expect(dashboard.error).toBe(tasksError);
    });

    it('H-09: controls a cleanup failure for an invalid session', async () => {
      tabStorage.setItem('workshop_token', 'token');
      tabStorage.setItem('workshop_user', 'null');
      vi.spyOn(tabStorage, 'removeItem').mockImplementation(() => {
        throw new DOMException('Storage denied', 'SecurityError');
      });
      const get = vi.spyOn(axios, 'get');

      await expect(dashboard.ngOnInit()).resolves.toBeUndefined();

      expect(get).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(dashboard.loading).toBe(false);
      expect(dashboard.error).toBe(tasksError);
    });

    it.each(['workshop_token', 'workshop_user', 'navigation', 'navigation-false'])('H-10: controls logout failure at %s', async (stage) => {
      session.saveSession(validLogin.user);
      vi.spyOn(axios, 'post').mockResolvedValue(response(null));
      const failure = new Error('Logout failed');
      if (stage === 'navigation-false') {
        navigate.mockResolvedValue(false);
      } else if (stage === 'navigation') {
        navigate.mockRejectedValue(failure);
      } else {
        const originalRemove = tabStorage.removeItem.bind(tabStorage);
        vi.spyOn(tabStorage, 'removeItem').mockImplementation((key) => {
          if (key === stage) throw failure;
          originalRemove(key);
        });
      }

      await expect(dashboard.logout()).resolves.toBeUndefined();

      expect(dashboard.error).toBe('No se pudo cerrar sesión. Inténtalo de nuevo.');
      if (stage.startsWith('navigation')) {
        expect(session.getSession()).toBeNull();
      } else {
        expect(navigate).not.toHaveBeenCalled();
      }
    });

    it('H-11: removes the partial session after a failed user write', async () => {
      vi.spyOn(axios, 'post').mockResolvedValue(response(validLogin));
      const originalSet = tabStorage.setItem.bind(tabStorage);
      vi.spyOn(tabStorage, 'setItem').mockImplementation((key, value) => {
        if (key === 'workshop_user') throw new Error('Storage full');
        originalSet(key, value);
      });

      await login.login();

      expect(login.message).toBe(loginError);
      expect(login.busy).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
      expect(tabStorage.getItem('workshop_token')).toBeNull();
      expect(tabStorage.getItem('workshop_user')).toBeNull();
    });
  });

});
