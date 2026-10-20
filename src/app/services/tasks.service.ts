import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { DisplayTask, isTaskRecord, TaskLists, TaskRecord } from '../models/task.models';
import { formatTaskLabel } from '../utils/legacy-format';

@Injectable({ providedIn: 'root' })
export class TasksService {
  async getTasks(owner: string): Promise<TaskLists> {
    const url = `${environment.tasksApiUrl}/api/tasks?owner=${encodeURIComponent(owner)}`;
    const response = await axios.get<unknown>(url, { withCredentials: true });
    const tasks = parseTasks(response.data);
    const visibleTasks = tasks
      .filter((task) => task.status !== 'ARCHIVED')
      .map((task): DisplayTask => ({ ...task, label: formatTaskLabel(task) }))
      .sort(compareTaskPriority);

    return { tasks, visibleTasks };
  }
}

export class InvalidTasksResponseError extends Error {
  constructor() {
    super('The tasks response must be a list of valid tasks');
    this.name = 'InvalidTasksResponseError';
  }
}

function parseTasks(value: unknown): TaskRecord[] {
  if (!Array.isArray(value) || !value.every(isTaskRecord)) {
    throw new InvalidTasksResponseError();
  }
  return value;
}

function compareTaskPriority(left: DisplayTask, right: DisplayTask): number {
  const leftPriority = left.priority ?? '';
  const rightPriority = right.priority ?? '';
  if (leftPriority === rightPriority) {
    return 0;
  }
  return leftPriority > rightPriority ? -1 : 1;
}
