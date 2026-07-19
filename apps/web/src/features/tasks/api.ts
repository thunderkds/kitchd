import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';
import type {
  ChecklistItem,
  CompletionPreview,
  CompletionResult,
  Task,
  TaskStatus,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken() ?? ''}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    // T029 — fetch rejected outright (network failure), not a non-2xx
    // response. Surface the same shared dialog rather than an unhandled
    // rejection (Acceptance Criterion 2).
    const message = 'Network error — unable to reach the server. Please check your connection and try again.';
    notifyApiError(message);
    throw new Error(message);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message ?? `Request failed (${res.status})`;
    notifyApiError(message);
    throw new Error(message);
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

// T011 — two-step confirm-before-deduct stock flow (FR-008). Preview is
// read-only (computes the would-be deductions); confirm actually applies
// the StockMovement(CONSUME) writes and marks the Task DONE.
export function previewTaskCompletion(id: string): Promise<CompletionPreview> {
  return request<CompletionPreview>(`/tasks/${id}/complete/preview`, {
    method: 'POST',
  });
}

export function confirmTaskCompletion(id: string): Promise<CompletionResult> {
  return request<CompletionResult>(`/tasks/${id}/complete/confirm`, {
    method: 'POST',
  });
}
