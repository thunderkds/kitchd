import { TASK_STATUSES, type Task, type TaskStatus } from './types';

/**
 * Kanban card. Draggable on pointer devices (native HTML5 DnD); the
 * "Move to" buttons are the tap-to-move fallback for touch devices where
 * drag is unreliable, per the Edge Case Checklist — always rendered, not
 * hidden behind a touch-detection heuristic.
 */
export function TaskCard({
  task,
  onMove,
  sourceTitle,
  onEdit,
}: {
  task: Task;
  onMove: (taskId: string, status: TaskStatus) => void;
  // T035 — resolved client-side by the caller (TasksPage) from the
  // fetched recipes/guidelines lite lists; undefined/null when the task
  // has no source or the source title couldn't be resolved.
  sourceTitle?: string | null;
  // T039 — provided only when the caller may edit this task (role gate
  // lives in TasksPage); absent means no Edit control is rendered at all.
  onEdit?: () => void;
}) {
  const otherStatuses = TASK_STATUSES.filter((s) => s.value !== task.status);

  return (
    <div
      className="bg-surface-raised border rounded-lg shadow-sm p-3 mb-3"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}
      data-testid={`task-card-${task.id}`}
    >
      <p className="font-medium text-sm break-words">{task.title}</p>
      <p className="text-xs text-muted mt-1">
        {task.assigneeId ? `Assigned: ${task.assigneeId.slice(0, 8)}` : 'Unassigned'}
      </p>
      {sourceTitle && (
        <p className="text-xs text-muted mt-1 break-words">From: {sourceTitle}</p>
      )}
      <div className="flex flex-wrap gap-1 mt-2">
        {otherStatuses.map((s) => (
          <button
            key={s.value}
            type="button"
            className="text-xs px-2 py-1 min-h-[44px] min-w-[44px] rounded border bg-surface hover:opacity-80"
            onClick={() => onMove(task.id, s.value)}
          >
            Move to {s.label}
          </button>
        ))}
        {onEdit && (
          <button
            type="button"
            className="text-xs px-2 py-1 min-h-[44px] min-w-[44px] rounded border bg-surface hover:opacity-80"
            onClick={onEdit}
            aria-label={`Edit ${task.title}`}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
