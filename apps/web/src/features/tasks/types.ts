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
  createdAt: string;
  updatedAt: string;
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
