import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticatedUser } from '../models/auth.models';
import { DisplayTask, TaskRecord } from '../models/task.models';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { toUserFacingError } from '../utils/api-error';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Completado',
  RESUELTO: 'Resuelto',
  COMPLETED: 'Completado'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: TaskRecord[] = [];
  visibleTasks: DisplayTask[] = [];
  user: AuthenticatedUser = { username: '' };
  loading = true;
  error = '';

  constructor(
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
    private readonly sessionService: SessionService,
    private readonly tasksService: TasksService
  ) {}

  statusLabel(status: string | null | undefined): string {
    if (!status) {
      return '';
    }
    return STATUS_LABELS[status.toUpperCase()] ?? status;
  }

  async ngOnInit(): Promise<void> {
    try {
      const session = this.sessionService.getSession();
      if (!session) {
        await this.router.navigate(['/login']);
        this.zone.run(() => {
          this.loading = false;
          this.cdr.detectChanges();
        });
        return;
      }

      this.user = session.user;
      const taskLists = await this.tasksService.getTasks(session.user.username, session.token);
      this.zone.run(() => {
        this.tasks = taskLists.tasks;
        this.visibleTasks = taskLists.visibleTasks;
        this.loading = false;
        this.cdr.detectChanges();
      });
    } catch (error: unknown) {
      this.zone.run(() => {
        this.error = toUserFacingError(error, 'tasks');
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async logout(): Promise<void> {
    try {
      this.error = '';
      this.sessionService.clearSession();
      const navigated = await this.router.navigate(['/login']);
      if (!navigated) {
        throw new Error('Logout navigation was canceled');
      }
    } catch {
      this.zone.run(() => {
        this.error = 'No se pudo cerrar sesión. Inténtalo de nuevo.';
        this.cdr.detectChanges();
      });
    }
  }
}
