import { useState } from 'react';
import { Dialog } from '../../components/Dialog/Dialog';
import { updateTask } from './api';
import type {
  AssigneeOption,
  ChecklistItemInput,
  Task,
  UpdateTaskInput,
} from './types';

/** An ISO instant -> the `yyyy-mm-dd` an `<input type="date">` expects, in local time. */
export function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A `yyyy-mm-dd` date-input value -> the full ISO instant `UpdateTaskDto`
 * requires (`@IsDateString`). Interpreted as local midnight, so the date
 * the user picked is the date they see again after a round-trip.
 */
export function toIsoFromDateInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

// Local editing shape: `key` is a stable React key, `id` is the server-side
// id (absent for a newly added item so the server mints the UUID).
interface EditableChecklistItem {
  key: string;
  id?: string;
  text: string;
  done: boolean;
}

function toEditableItems(task: Task): EditableChecklistItem[] {
  return task.checklistItems.map((item) => ({
    key: item.id,
    id: item.id,
    text: item.text,
    done: item.done,
  }));
}

function toPayloadItems(items: EditableChecklistItem[]): ChecklistItemInput[] {
  return items.map((item) => (item.id ? { id: item.id, text: item.text, done: item.done } : { text: item.text, done: item.done }));
}

/**
 * T039 — edit an existing Task's title, assignee, due date and checklist.
 *
 * Deliberately has **no status control**: a Task reaches DONE only through
 * the T011 preview/confirm completion flow (FR-008), and a plain
 * `PATCH { status: 'DONE' }` here would silently skip the stock deduction.
 * Status stays with the existing "Move to …" controls.
 *
 * `canEditDetails` mirrors `TasksService.update`: OWNER/ADMIN/CHEF may
 * change any field, STAFF may change only the checklist of a task assigned
 * to them (so the other inputs are not rendered at all — not merely
 * disabled), VIEWER never reaches this dialog. The client gate is an
 * affordance only; the server remains the authority.
 */
export function EditTaskDialog({
  task,
  canEditDetails,
  assigneeOptions,
  onSaved,
  onClose,
}: {
  task: Task;
  canEditDetails: boolean;
  assigneeOptions: AssigneeOption[];
  onSaved: (task: Task) => void;
  onClose: () => void;
}) {
  const originalDueDate = toDateInputValue(task.dueAt);

  const [title, setTitle] = useState(task.title);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '');
  const [dueDate, setDueDate] = useState(originalDueDate);
  const [items, setItems] = useState<EditableChecklistItem[]>(toEditableItems(task));
  const [nextItemKey, setNextItemKey] = useState(1);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The current assignee may not be in `assigneeOptions` (e.g. deactivated,
  // or the caller cannot read GET /users) — keep it selectable so opening
  // the dialog never silently reassigns the task.
  const options =
    task.assigneeId && !assigneeOptions.some((option) => option.id === task.assigneeId)
      ? [...assigneeOptions, { id: task.assigneeId, label: task.assigneeId.slice(0, 8) }]
      : assigneeOptions;

  const updateItem = (key: string, text: string) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, text } : item)));
    if (formError) setFormError(null);
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
    if (formError) setFormError(null);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { key: `new-${nextItemKey}`, text: '', done: false }]);
    setNextItemKey((value) => value + 1);
  };

  /** Only the fields the user actually changed — never a whole-task overwrite. */
  const buildPayload = (): UpdateTaskInput => {
    const payload: UpdateTaskInput = {};

    if (canEditDetails) {
      const nextTitle = title.trim();
      if (nextTitle !== task.title) payload.title = nextTitle;

      const nextAssigneeId = assigneeId === '' ? null : assigneeId;
      if (nextAssigneeId !== (task.assigneeId ?? null)) payload.assigneeId = nextAssigneeId;

      if (dueDate !== originalDueDate) {
        const iso = toIsoFromDateInput(dueDate);
        if (iso) payload.dueAt = iso;
      }
    }

    const nextItems = toPayloadItems(items);
    if (JSON.stringify(nextItems) !== JSON.stringify(toPayloadItems(toEditableItems(task)))) {
      payload.checklistItems = nextItems;
    }

    return payload;
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    if (canEditDetails && !title.trim()) {
      setFormError('Title is required');
      return;
    }
    // `UpdateTaskDto.dueAt` is `@IsOptional() @IsDateString()`: there is no
    // wire representation for "remove the due date" (null would be coerced
    // to the epoch server-side), so refuse the change loudly rather than
    // dropping it silently. Clearing needs a backend change — out of scope.
    if (canEditDetails && originalDueDate && !dueDate) {
      setFormError('Clearing a due date is not supported yet.');
      return;
    }
    if (items.some((item) => !item.text.trim())) {
      setFormError('Checklist items cannot be empty.');
      return;
    }
    setFormError(null);

    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateTask(task.id, payload);
      onSaved(updated);
      onClose();
    } catch (err) {
      // The shared error dialog already surfaced the server message
      // (T029); this inline copy keeps the context next to the form.
      setSubmitError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog titleId="edit-task-dialog-title" onClose={onClose}>
      <h2 id="edit-task-dialog-title" className="text-lg font-semibold mb-4">
        Edit Task
      </h2>

      {submitError && <p className="text-danger text-sm mb-3">{submitError}</p>}
      {formError && <p className="text-danger text-sm mb-3">{formError}</p>}

      <div className="flex flex-col gap-3">
        {canEditDetails && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Title
              <input
                className="border rounded px-2 py-2 text-sm"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (formError) setFormError(null);
                }}
                aria-label="Task title"
                aria-invalid={formError === 'Title is required' ? true : undefined}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Assignee
              <select
                className="border rounded px-2 py-2 text-sm"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Due date
              <input
                type="date"
                className="border rounded px-2 py-2 text-sm"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (formError) setFormError(null);
                }}
                aria-label="Due date"
              />
            </label>
          </>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm">Checklist</span>
          {items.length === 0 && (
            <p className="text-muted text-xs">No checklist items yet.</p>
          )}
          {items.map((item, index) => (
            <div key={item.key} className="flex items-center gap-2">
              <input
                className="border rounded px-2 py-2 text-sm flex-1 min-w-0"
                value={item.text}
                onChange={(e) => updateItem(item.key, e.target.value)}
                aria-label={`Checklist item ${index + 1}`}
              />
              <button
                type="button"
                className="text-xs px-2 py-1 min-h-[44px] min-w-[44px] rounded border bg-surface hover:opacity-80"
                onClick={() => removeItem(item.key)}
                aria-label={`Remove checklist item ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs px-2 py-1 min-h-[44px] self-start rounded border bg-surface hover:opacity-80"
            onClick={addItem}
          >
            Add checklist item
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button
          type="button"
          className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded border bg-surface hover:opacity-80"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded bg-accent text-white hover:opacity-90 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </Dialog>
  );
}
