import '@angular/compiler';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidTasksResponseError, TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService();
  });

  it('preserves the tasks endpoint, sends cookies, and shapes visible tasks', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue({
      data: [
        { title: 'Low', description: 'low', status: 'TODO', priority: 'LOW', owner: 'student' },
        { title: 'Old', description: 'old', status: 'ARCHIVED', priority: 'URGENT', owner: 'student' },
        { title: 'High', description: 'high', status: 'DONE', priority: 'HIGH', owner: 'student' }
      ]
    } as AxiosResponse);

    const result = await service.getTasks('student');

    expect(get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      withCredentials: true
    });
    expect(result.tasks).toHaveLength(3);
    expect(result.visibleTasks.map((task) => task.title)).toEqual(['Low', 'High']);
    expect(result.visibleTasks.map((task) => task.label)).toEqual(['LOW · STUDENT', 'HIGH · STUDENT']);
  });

  it('encodes the owner query parameter without changing the endpoint contract', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: [] } as AxiosResponse);

    await service.getTasks('student+trainer');

    expect(get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student%2Btrainer', {
      withCredentials: true
    });
  });

  it('rejects non-list and malformed task responses explicitly', async () => {
    vi.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { tasks: [] } } as AxiosResponse)
      .mockResolvedValueOnce({ data: [{ status: 3 }] } as AxiosResponse);

    await expect(service.getTasks('student')).rejects.toBeInstanceOf(InvalidTasksResponseError);
    await expect(service.getTasks('student')).rejects.toBeInstanceOf(InvalidTasksResponseError);
  });

  it('preserves numeric priorities and owners accepted by the existing label formatter', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: [
        { title: 'One', status: 'TODO', priority: 1, owner: 42 },
        { title: 'Two', status: 'TODO', priority: 2, owner: 42 }
      ]
    } as AxiosResponse);

    const result = await service.getTasks('student');

    expect(result.visibleTasks.map((task) => task.title)).toEqual(['Two', 'One']);
    expect(result.visibleTasks[0]?.label).toBe('2 · 42');
  });
});
