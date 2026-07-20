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
