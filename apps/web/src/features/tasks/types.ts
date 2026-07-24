export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  kitchenId: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  dueAt: string | null;
  checklistItems: ChecklistItem[];
  // T035 — surfaced so the UI can show "From: <Recipe/Guideline title>";
  // both already existed on the backend model (T009) but were dropped by
  // the frontend type. Mutually exclusive, both null for a plain task.
  sourceRecipeId: string | null;
  sourceGuidelineId: string | null;
  createdAt: string;
  updatedAt: string;
}

// T035 — lightweight id+title shapes for the Recipe/Guideline pickers in
// CreateTaskDialog. Intentionally not the full Recipe/Guideline types
// (no dedicated Recipes page exists yet — out of scope, see TASK_GUIDE).
export interface RecipeLite {
  id: string;
  name: string;
}

export interface GuidelineLite {
  id: string;
  title: string;
}

export interface CreateTaskInput {
  title: string;
  assigneeId?: string;
  dueAt?: string;
}

// T039 — a checklist item as *sent* to PATCH /tasks/:id. `id` is omitted
// for a newly added item so the server mints the UUID (tasks.service.ts
// `item.id ?? crypto.randomUUID()`); existing items keep their id and
// `done` so editing the text here never resets completion state.
export interface ChecklistItemInput {
  id?: string;
  text: string;
  done?: boolean;
}

/**
 * T039 — the editable subset of `UpdateTaskDto`. `status` is deliberately
 * absent: moving a Task to DONE must go through the T011
 * preview/confirm completion flow (FR-008), and a plain
 * `PATCH { status: 'DONE' }` would bypass the stock deduction entirely.
 * `assigneeId: null` unassigns (the DTO's `@IsOptional()` skips null, and
 * the service writes it straight through).
 */
export interface UpdateTaskInput {
  title?: string;
  assigneeId?: string | null;
  dueAt?: string;
  checklistItems?: ChecklistItemInput[];
}

// T039 — one selectable assignee for the edit form. Resolved by TasksPage:
// `email` from GET /users when the caller may read it (OWNER/ADMIN only),
// otherwise a truncated id, matching the existing assignee-filter dropdown.
export interface AssigneeOption {
  id: string;
  label: string;
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
];

// T011 — stock deduction preview/confirm response shapes, mirroring
// TaskCompletionService (apps/api/src/tasks/complete).
export interface StockDeduction {
  ingredientId: string;
  deductQty: number;
  currentStock: number;
  resultingStock: number;
  wouldGoNegative: boolean;
}

export interface CompletionPreview {
  requiresConfirmation: boolean;
  deductions: StockDeduction[];
  hasNegativeWarning: boolean;
}

export interface CompletionResult {
  task: Task;
  movements: { id: string; ingredientId: string; qty: number }[];
  hasNegativeWarning: boolean;
}
