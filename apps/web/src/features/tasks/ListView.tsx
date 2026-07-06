import { TASK_STATUSES, type Task } from './types';

const STATUS_LABEL = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s.label]),
);

/**
 * Flat list rendering of the same Task data shown in the kanban board
 * (AC3) — a filtered task never differs between views, only presentation
 * does.
 */
export function ListView({
  tasks,
  onToggleChecklistItem,
}: {
  tasks: Task[];
  onToggleChecklistItem: (taskId: string, itemId: string, done: boolean) => void;
}) {
  return (
    <ul className="flex flex-col gap-2" data-testid="task-list-view">
      {tasks.map((task) => (
        <li key={task.id} className="bg-white border rounded-lg p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate min-w-0">{task.title}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 shrink-0">
              {STATUS_LABEL[task.status]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {task.assigneeId ? `Assigned: ${task.assigneeId.slice(0, 8)}` : 'Unassigned'}
          </p>
          {task.checklistItems.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {task.checklistItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={item.done}
                    onChange={(e) =>
                      onToggleChecklistItem(task.id, item.id, e.target.checked)
                    }
                  />
                  <span className={item.done ? 'line-through text-gray-400' : ''}>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
