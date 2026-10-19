import { isRecord } from './auth.models';

export interface TaskRecord {
  status?: string | null;
  priority?: string | number | null;
  owner?: string | number | null;
  title?: string | null;
  description?: string | null;
  [property: string]: unknown;
}

export interface DisplayTask extends TaskRecord {
  label: string;
}

export interface TaskLists {
  tasks: TaskRecord[];
  visibleTasks: DisplayTask[];
}

export function isTaskRecord(value: unknown): value is TaskRecord {
  return isRecord(value)
    && isOptionalString(value['status'])
    && isOptionalLabelValue(value['priority'])
    && isOptionalLabelValue(value['owner'])
    && isOptionalString(value['title'])
    && isOptionalString(value['description']);
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalLabelValue(value: unknown): value is string | number | null | undefined {
  return value === undefined || value === null || typeof value === 'string' || typeof value === 'number';
}
