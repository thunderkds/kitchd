import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';
import type {
  ChecklistItem,
  CompletionPreview,
  CompletionResult,
  CreateTaskInput,
  GuidelineLite,
  RecipeLite,
  Task,
  TaskStatus,
  UpdateTaskInput,
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

// T035 — plain create (AC2) and the two generate-from-source modes (AC3/AC4).
// All three endpoints already existed server-side (T008/T009); this is the
// first frontend consumer.
export function createTask(input: CreateTaskInput): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function generateTaskFromRecipe(recipeId: string): Promise<Task> {
  return request<Task>(`/tasks/generate-from-recipe/recipe/${recipeId}`, {
    method: 'POST',
  });
}

export function generateTaskFromGuideline(guidelineId: string): Promise<Task> {
  return request<Task>(`/tasks/generate-from-recipe/guideline/${guidelineId}`, {
    method: 'POST',
  });
}

// Lightweight id+title lists for the Create Task pickers — reuses the
// existing /recipes and /guidelines list endpoints (no new backend routes).
export function listRecipesLite(): Promise<RecipeLite[]> {
  return request<RecipeLite[]>('/recipes');
}

export function listGuidelinesLite(): Promise<GuidelineLite[]> {
  return request<GuidelineLite[]>('/guidelines');
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

/**
 * T039 — full-field task edit (title / assignee / due date / checklist).
 * Same `PATCH /tasks/:id` endpoint as `updateTaskStatus` /
 * `updateTaskChecklist`; the caller sends only the fields it actually
 * changed, so an edit never clobbers a field another client changed
 * meanwhile. RBAC is enforced server-side in `TasksService.update`.
 */
export function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
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
