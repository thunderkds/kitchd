import { useEffect, useState } from 'react';
import { listTasks } from '../../features/tasks/api';
import type { Task } from '../../features/tasks/types';
import { getUser } from '../../routes/auth';

const MAX_ITEMS = 5;
const ALL_KITCHEN_ROLES = new Set(['OWNER', 'ADMIN', 'CHEF']);

/**
 * T018 — Dashboard's Tasks widget. GET /tasks (T008) returns all Tasks
 * for the caller's Kitchen with no server-side role scoping (RolesGuard
 * only gates writes), so "my tasks today" (Staff/Viewer) vs "all Kitchen
 * tasks" (Owner/Admin/Chef) is a client-side filter here, keyed off the
 * role stored at login (see routes/auth.ts).
 */
export function TasksWidget() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTasks()
      .then((data) => {
        if (!cancelled) setTasks(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const user = getUser();
  const showAll = user ? ALL_KITCHEN_ROLES.has(user.role) : false;
  const scoped =
    tasks === null
      ? null
      : showAll
        ? tasks
        : tasks.filter((task) => task.assigneeId === user?.id);
  const visible = (scoped ?? []).slice(0, MAX_ITEMS);

  return (
    <div className="border rounded-lg p-4 w-full" data-testid="tasks-widget">
      <h3 className="text-sm font-semibold text-primary mb-3">
        {showAll ? 'Kitchen Tasks' : 'My Tasks'}
      </h3>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {!error && scoped === null && <p className="text-sm text-muted">Loading…</p>}

      {!error && scoped !== null && visible.length === 0 && (
        <p className="text-sm text-muted" data-testid="tasks-widget-empty">
          No tasks yet. Assigned tasks will show up here.
        </p>
      )}

      {!error && scoped !== null && visible.length > 0 && (
        <ul className="divide-y" data-testid="tasks-widget-list">
          {visible.map((task) => (
            <li
              key={task.id}
              data-testid={`tasks-widget-row-${task.id}`}
              className="flex items-center justify-between gap-2 px-1 py-2 text-sm"
            >
              <span className="truncate min-w-0">{task.title}</span>
              <span className="text-muted shrink-0">{task.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
