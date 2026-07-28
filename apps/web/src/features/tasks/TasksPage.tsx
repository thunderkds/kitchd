import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getUser } from '../../routes/auth';
import type { UserRole } from '../../routes/auth';
// T035 — reused to resolve ingredient names for CompleteTaskDialog (FR-008
// human-reviewable deduction confirmation); no new backend endpoint needed.
import { listIngredients } from '../inventory/api';
import {
  confirmTaskCompletion,
  fetchAssignableUsers,
  listGuidelinesLite,
  listRecipesLite,
  listTasks,
  previewTaskCompletion,
  updateTaskChecklist,
  updateTaskStatus,
} from './api';
import { CompleteTaskDialog } from './CompleteTaskDialog/CompleteTaskDialog';
import { CreateTaskDialog } from './CreateTaskDialog';
import { EditTaskDialog } from './EditTaskDialog';
import { KanbanBoard } from './KanbanBoard';
import { ListView } from './ListView';
import { ViewToggle } from './ViewToggle';
import type {
  AssignableUser,
  AssigneeOption,
  CompletionPreview,
  GuidelineLite,
  RecipeLite,
  Task,
  TaskStatus,
} from './types';

const UNASSIGNED = 'unassigned';

// T035 — same RBAC shape as Task PATCH mutations (`WRITE_ROLES` in
// tasks.service.ts) and identical to Inventory/Guidelines' create gate.
const WRITE_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'CHEF'];

/**
 * Kanban and list views render the same fetched Task[] (AC3) — only the
 * `view` and `assignee` query params (not separate data fetches) change
 * on toggle, so the underlying data and the active filter are always in
 * sync across views.
 */
export function TasksPage() {
  const caller = getUser();
  const canCreate = !!caller && WRITE_ROLES.includes(caller.role);

  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // T039 — the task currently open in EditTaskDialog (null = closed).
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  // T040 — active kitchen members (id + email) for the assignee picker.
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  // T035 — id+title lookups to resolve a task's "From: <title>" line.
  // Only WRITE_ROLES callers can create tasks, but any caller may view an
  // already-generated task's source, so these are fetched unconditionally.
  const [recipes, setRecipes] = useState<RecipeLite[]>([]);
  const [guidelines, setGuidelines] = useState<GuidelineLite[]>([]);
  const [ingredientNameById, setIngredientNameById] = useState<Record<string, string>>({});

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
    // Best-effort source-title lookups — a failure here must not block the
    // task list itself, so failures are swallowed (falls back to no "From:"
    // line rather than an error banner over unrelated data).
    listRecipesLite()
      .then(setRecipes)
      .catch(() => {});
    listGuidelinesLite()
      .then(setGuidelines)
      .catch(() => {});
    listIngredients()
      .then((data) =>
        setIngredientNameById(Object.fromEntries(data.map((i) => [i.id, i.name]))),
      )
      .catch(() => {});
    // T040 — gated on the role, not just on the rendered control: only the
    // Task write roles may reassign, and only they may read
    // GET /users/assignable, so STAFF/VIEWER never make a call that 403s
    // (and never trip the global error dialog).
    // Read inside the effect (not the outer `caller`) to keep this a
    // genuine mount-only effect with no dependency list churn.
    const current = getUser();
    if (current && WRITE_ROLES.includes(current.role)) {
      fetchAssignableUsers()
        .then(setAssignableUsers)
        .catch(() => {});
    }
  }, []);

  const sourceTitleForTask = (task: Task): string | null => {
    if (task.sourceRecipeId) {
      return recipes.find((r) => r.id === task.sourceRecipeId)?.name ?? null;
    }
    if (task.sourceGuidelineId) {
      return guidelines.find((g) => g.id === task.sourceGuidelineId)?.title ?? null;
    }
    return null;
  };

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

  /**
   * T039 — mirrors `TasksService.update` exactly: OWNER/ADMIN/CHEF may edit
   * any task in their kitchen; STAFF only a task assigned to them (and then
   * only its checklist — see `canEditDetails` below); VIEWER never. A null
   * caller (stale session) gets the narrower view: no edit affordance.
   */
  const canEditTask = (task: Task): boolean => {
    if (!caller) return false;
    if (WRITE_ROLES.includes(caller.role)) return true;
    return caller.role === 'STAFF' && task.assigneeId === caller.id;
  };

  // Assignable users, all kitchen-scoped: emails from GET /users/assignable
  // (already filtered to active members of the caller's own kitchen), plus
  // any id still present on this kitchen's tasks — the fallback is what keeps
  // a since-deactivated assignee selectable instead of silently cleared.
  // Never an id from an unscoped source.
  const assigneeOptions: AssigneeOption[] = (() => {
    const options: AssigneeOption[] = assignableUsers.map((user) => ({
      id: user.id,
      label: user.email,
    }));
    const known = new Set(options.map((option) => option.id));
    for (const id of assigneeIds) {
      if (!known.has(id)) {
        options.push({ id, label: id.slice(0, 8) });
        known.add(id);
      }
    }
    return options;
  })();

  const handleTaskSaved = (updated: Task) => {
    // Single source of truth for both views — no manual refresh needed.
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

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
          {canCreate && (
            <button
              type="button"
              className="px-3 py-2 text-sm rounded bg-accent text-white"
              onClick={() => setShowCreateDialog(true)}
            >
              New Task
            </button>
          )}
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
        <KanbanBoard
          tasks={filteredTasks}
          onMove={handleMove}
          sourceTitleForTask={sourceTitleForTask}
          onEditTask={setEditingTask}
          canEditTask={canEditTask}
        />
      ) : (
        <ListView
          tasks={filteredTasks}
          onToggleChecklistItem={handleToggleChecklistItem}
          sourceTitleForTask={sourceTitleForTask}
          onEditTask={setEditingTask}
          canEditTask={canEditTask}
        />
      )}

      {showCreateDialog && canCreate && (
        <CreateTaskDialog
          onCreated={(created) => setTasks((prev) => [created, ...prev])}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {editingTask && canEditTask(editingTask) && (
        <EditTaskDialog
          task={editingTask}
          // STAFF may change only status + checklistItems server-side, so
          // the detail fields are not rendered for them at all.
          canEditDetails={!!caller && WRITE_ROLES.includes(caller.role)}
          assigneeOptions={assigneeOptions}
          onSaved={handleTaskSaved}
          onClose={() => setEditingTask(null)}
        />
      )}

      {pendingCompletion && (
        <CompleteTaskDialog
          preview={pendingCompletion.preview}
          loading={confirmLoading}
          onConfirm={handleConfirmCompletion}
          onCancel={handleCancelCompletion}
          ingredientNameById={ingredientNameById}
        />
      )}
    </div>
  );
}
