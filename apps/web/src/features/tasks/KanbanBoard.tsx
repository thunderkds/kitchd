import { TASK_STATUSES, type Task, type TaskStatus } from './types';
import { TaskCard } from './TaskCard';

// Semantic mapping: TODO uses the accent color, IN_PROGRESS is in-flight
// (warning), DONE is complete (success) — reuses the same 9-token set,
// no status-specific tokens invented.
const COLUMN_COLORS: Record<TaskStatus, string> = {
  TODO: 'border-t-accent',
  IN_PROGRESS: 'border-t-warning',
  DONE: 'border-t-success',
};

export function KanbanBoard({
  tasks,
  onMove,
  sourceTitleForTask,
  onEditTask,
  canEditTask,
}: {
  tasks: Task[];
  onMove: (taskId: string, status: TaskStatus) => void;
  // T035 — resolves a task's "From: <title>" line; optional so existing
  // callers/tests are unaffected.
  sourceTitleForTask?: (task: Task) => string | null | undefined;
  // T039 — role-gated edit affordance; the Edit control renders only when
  // both an handler and a per-task permission check are supplied.
  onEditTask?: (task: Task) => void;
  canEditTask?: (task: Task) => boolean;
}) {
  return (
    <div
      className="flex gap-4 overflow-x-auto pb-2"
      data-testid="kanban-board"
    >
      {TASK_STATUSES.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.value);
        return (
          <div
            key={column.value}
            className={`flex-1 min-w-[260px] bg-surface rounded-lg p-3 border-t-4 ${COLUMN_COLORS[column.value]}`}
            data-testid={`kanban-column-${column.value}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const taskId = e.dataTransfer.getData('text/task-id');
              if (taskId) {
                onMove(taskId, column.value);
              }
            }}
          >
            <h3 className="font-semibold text-sm mb-3">
              {column.label} ({columnTasks.length})
            </h3>
            {columnTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onMove={onMove}
                sourceTitle={sourceTitleForTask?.(task)}
                onEdit={
                  onEditTask && canEditTask?.(task) ? () => onEditTask(task) : undefined
                }
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
