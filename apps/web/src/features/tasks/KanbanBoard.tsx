import { TASK_STATUSES, type Task, type TaskStatus } from './types';
import { TaskCard } from './TaskCard';

// Semantic mapping: TODO is neutral (border), IN_PROGRESS is in-flight
// (warning), DONE is complete (success) — reuses the same 9-token set,
// no status-specific tokens invented.
const COLUMN_COLORS: Record<TaskStatus, string> = {
  TODO: 'border-t-border',
  IN_PROGRESS: 'border-t-warning',
  DONE: 'border-t-success',
};

export function KanbanBoard({
  tasks,
  onMove,
}: {
  tasks: Task[];
  onMove: (taskId: string, status: TaskStatus) => void;
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
              <TaskCard key={task.id} task={task} onMove={onMove} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
