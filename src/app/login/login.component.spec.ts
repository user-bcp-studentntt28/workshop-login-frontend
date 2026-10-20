import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { InvalidLoginResponseError } from '../services/auth.service';

describe('LoginComponent', () => {
  let authenticate: ReturnType<typeof vi.fn>;
  let loadPreferences: ReturnType<typeof vi.fn>;
  let savePreferences: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let component: LoginComponent;

  beforeEach(() => {
    authenticate = vi.fn().mockResolvedValue(undefined);
    loadPreferences = vi.fn((defaults) => defaults);
    savePreferences = vi.fn();
    navigate = vi.fn(async () => true);
    component = new LoginComponent(
      { authenticate } as never,
      { loadPreferences, savePreferences } as never,
      { navigate } as never
    );
  });

  it('rejects an empty username without authenticating', async () => {
    await component.login();

    expect(authenticate).not.toHaveBeenCalled();
    expect(component.message).toBe('Ingrese un usuario.');
  });

  it('rejects an empty password without authenticating', async () => {
    component.username = 'student';

    await component.login();

    expect(authenticate).not.toHaveBeenCalled();
    expect(component.message).toBe('Ingrese una contraseña.');
  });

  it('authenticates, persists preferences, and navigates on success', async () => {
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(authenticate).toHaveBeenCalledWith({
      username: 'student',
      password: 'Workshop123!',
      client: 'angular-workshop'
    });
    expect(savePreferences).toHaveBeenCalledWith(component.preferences);
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.busy).toBe(false);
  });

  it('does not navigate when authentication returns an unusable response', async () => {
    authenticate.mockRejectedValue(new InvalidLoginResponseError());
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('El backend respondió sin una sesión válida.');
    expect(navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });

  it('shows a safe message without backend details after a request error', async () => {
    authenticate.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Internal backend detail' } }
    });
    component.username = '<img src=x>';
    component.password = 'wrong';

    await component.login();

    expect(component.message).toBe('No se pudo iniciar sesión. Inténtalo de nuevo.');
    expect(component.message).not.toContain('Internal backend detail');
    expect(navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });
});
