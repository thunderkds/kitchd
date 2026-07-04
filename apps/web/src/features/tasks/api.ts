import { getToken } from '../../routes/auth';
import type { ChecklistItem, Task, TaskStatus } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function listTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateTaskChecklist(
  id: string,
  checklistItems: ChecklistItem[],
): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ checklistItems }),
  });
}
