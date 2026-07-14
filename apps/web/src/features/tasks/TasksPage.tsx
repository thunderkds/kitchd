import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  confirmTaskCompletion,
  listTasks,
  previewTaskCompletion,
  updateTaskChecklist,
  updateTaskStatus,
} from './api';
import { CompleteTaskDialog } from './CompleteTaskDialog/CompleteTaskDialog';
import { KanbanBoard } from './KanbanBoard';
import { ListView } from './ListView';
import { ViewToggle } from './ViewToggle';
import type { CompletionPreview, Task, TaskStatus } from './types';

const UNASSIGNED = 'unassigned';

/**
 * Kanban and list views render the same fetched Task[] (AC3) — only the
 * `view` and `assignee` query params (not separate data fetches) change
 * on toggle, so the underlying data and the active filter are always in
 * sync across views.
 */
export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  // T011 — pending recipe-linked completion awaiting user confirm/cancel.
  const [pendingCompletion, setPendingCompletion] = useState<{
    taskId: string;
    preview: CompletionPreview;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const view = (searchParams.get('view') as 'kanban' | 'list') ?? 'kanban';
  const assigneeFilter = searchParams.get('assignee') ?? 'all';

  const refresh = async () => {
    try {
      const data = await listTasks();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const setView = (next: 'kanban' | 'list') => {
    const params = new URLSearchParams(searchParams);
    params.set('view', next);
    setSearchParams(params);
  };

  const setAssigneeFilter = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('assignee', next);
    setSearchParams(params);
  };

  const assigneeIds = Array.from(
    new Set(tasks.map((t) => t.assigneeId).filter((id): id is string => Boolean(id))),
  );

  const filteredTasks = tasks.filter((task) => {
    if (assigneeFilter === 'all') return true;
    if (assigneeFilter === UNASSIGNED) return !task.assigneeId;
    return task.assigneeId === assigneeFilter;
  });

  const handleMove = async (taskId: string, status: TaskStatus) => {
    // T011: moving a Task to DONE requires previewing the stock deduction
    // first (FR-008) — never a silent automatic deduction. Other moves
    // (TODO/IN_PROGRESS) are unaffected.
    if (status === 'DONE') {
      try {
        const preview = await previewTaskCompletion(taskId);
        if (preview.requiresConfirmation) {
          setPendingCompletion({ taskId, preview });
          return;
        }
        // Non-recipe task: no deduction to confirm, just complete it.
        const result = await confirmTaskCompletion(taskId);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? result.task : t)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete task');
      }
      return;
    }

    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await updateTaskStatus(taskId, status);
    } catch (err) {
      setTasks(previous);
      setError(err instanceof Error ? err.message : 'Failed to move task');
    }
  };

  const handleConfirmCompletion = async () => {
    if (!pendingCompletion) return;
    setConfirmLoading(true);
    try {
      const result = await confirmTaskCompletion(pendingCompletion.taskId);
      setTasks((prev) =>
        prev.map((t) => (t.id === pendingCompletion.taskId ? result.task : t)),
      );
      setPendingCompletion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancelCompletion = () => {
    setPendingCompletion(null);
  };

  const handleToggleChecklistItem = async (
    taskId: string,
    itemId: string,
    done: boolean,
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextItems = task.checklistItems.map((item) =>
      item.id === itemId ? { ...item, done } : item,
    );
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, checklistItems: nextItems } : t)),
    );
    try {
      await updateTaskChecklist(taskId, nextItems);
    } catch (err) {
      setTasks(previous);
      setError(err instanceof Error ? err.message : 'Failed to update checklist');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <div className="flex items-center gap-3">
          <select
            className="border rounded px-2 py-2 text-sm"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label="Filter by assignee"
          >
            <option value="all">All assignees</option>
            <option value={UNASSIGNED}>Unassigned</option>
            {assigneeIds.map((id) => (
              <option key={id} value={id}>
                {id.slice(0, 8)}
              </option>
            ))}
          </select>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      {filteredTasks.length === 0 ? (
        <p className="text-muted text-sm">
          No tasks yet. Assigned tasks will show up here.
        </p>
      ) : view === 'kanban' ? (
        <KanbanBoard tasks={filteredTasks} onMove={handleMove} />
      ) : (
        <ListView tasks={filteredTasks} onToggleChecklistItem={handleToggleChecklistItem} />
      )}

      {pendingCompletion && (
        <CompleteTaskDialog
          preview={pendingCompletion.preview}
          loading={confirmLoading}
          onConfirm={handleConfirmCompletion}
          onCancel={handleCancelCompletion}
        />
      )}
    </div>
  );
}
