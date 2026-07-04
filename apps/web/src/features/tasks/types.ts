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
