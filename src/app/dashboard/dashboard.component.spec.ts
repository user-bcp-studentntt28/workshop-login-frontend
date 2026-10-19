import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../models/auth.models';
import { TaskLists } from '../models/task.models';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let getSession: ReturnType<typeof vi.fn>;
  let clearSession: ReturnType<typeof vi.fn>;
  let getTasks: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let detectChanges: ReturnType<typeof vi.fn>;
  let component: DashboardComponent;

  beforeEach(() => {
    getSession = vi.fn().mockReturnValue({
      token: 'test-token',
      user: { username: 'student' }
    } satisfies AuthSession);
    clearSession = vi.fn();
    getTasks = vi.fn().mockResolvedValue({
      tasks: [
        { title: 'Low', description: 'low', status: 'TODO', priority: 'LOW', owner: 'student' },
        { title: 'High', description: 'high', status: 'IN_PROGRESS', priority: 'HIGH', owner: 'student' }
      ],
      visibleTasks: [
        { title: 'Low', description: 'low', status: 'TODO', priority: 'LOW', owner: 'student', label: 'LOW · STUDENT' },
        { title: 'High', description: 'high', status: 'IN_PROGRESS', priority: 'HIGH', owner: 'student', label: 'HIGH · STUDENT' }
      ]
    } satisfies TaskLists);
    navigate = vi.fn(async () => true);
    detectChanges = vi.fn();
    const zone = { run: (callback: () => void) => callback() };
    component = new DashboardComponent(
      { navigate } as never,
      { detectChanges } as never,
      zone as never,
      { getSession, clearSession } as never,
      { getTasks } as never
    );
  });

  it('redirects to login when there is no active session', async () => {
    getSession.mockReturnValue(null);

    await component.ngOnInit();

    expect(getTasks).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('loads tasks for the active user and presents service results', async () => {
    await component.ngOnInit();

    expect(getTasks).toHaveBeenCalledWith('student', 'test-token');
    expect(component.tasks).toHaveLength(2);
    expect(component.visibleTasks.map((task) => task.title)).toEqual(['Low', 'High']);
    expect(component.user.username).toBe('student');
    expect(component.loading).toBe(false);
    expect(component.statusLabel('IN_PROGRESS')).toBe('En progreso');
    expect(component.statusLabel('UNKNOWN')).toBe('UNKNOWN');
    expect(component.statusLabel(null)).toBe('');
    expect(detectChanges).toHaveBeenCalledOnce();
  });

  it('renders a safe generic message when task loading fails', async () => {
    getTasks.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { detail: 'Internal backend detail' } }
    });

    await component.ngOnInit();

    expect(component.error).toBe('No se pudieron cargar las tareas. Inténtalo de nuevo.');
    expect(component.error).not.toContain('Internal backend detail');
    expect(component.loading).toBe(false);
    expect(detectChanges).toHaveBeenCalledOnce();
  });

  it('clears the session and navigates to login on logout', async () => {
    await component.logout();

    expect(clearSession).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
