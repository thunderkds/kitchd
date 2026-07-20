import { useEffect, useState } from 'react';
import { Dialog } from '../../components/Dialog/Dialog';
import {
  createTask,
  generateTaskFromGuideline,
  generateTaskFromRecipe,
  listGuidelinesLite,
  listRecipesLite,
} from './api';
import type { GuidelineLite, RecipeLite, Task } from './types';

type CreateMode = 'plain' | 'recipe' | 'guideline';

const MODES: { value: CreateMode; label: string }[] = [
  { value: 'plain', label: 'Plain Task' },
  { value: 'recipe', label: 'From Recipe' },
  { value: 'guideline', label: 'From Guideline' },
];

/**
 * T035 — 3-mode Task creation dialog (Plain / Generate from Recipe /
 * Generate from Guideline). Mirrors the `Dialog` primitive + create-form
 * conventions already used by GuidelinesPage/InventoryPage. This component
 * performs its own network I/O (unlike CompleteTaskDialog) because create
 * is otherwise unrepresented anywhere in the app — the caller only needs
 * the resulting Task.
 */
export function CreateTaskDialog({
  onCreated,
  onClose,
}: {
  onCreated: (task: Task) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<CreateMode>('plain');

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);

  const [recipes, setRecipes] = useState<RecipeLite[]>([]);
  const [guidelines, setGuidelines] = useState<GuidelineLite[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedGuidelineId, setSelectedGuidelineId] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch pickers lazily, only when their mode is first selected — avoids
  // an unnecessary network call for the (default) Plain mode.
  useEffect(() => {
    if (mode === 'recipe' && recipes.length === 0 && !pickerLoading) {
      setPickerLoading(true);
      listRecipesLite()
        .then(setRecipes)
        .catch((err) => setPickerError(err instanceof Error ? err.message : 'Failed to load recipes'))
        .finally(() => setPickerLoading(false));
    }
    if (mode === 'guideline' && guidelines.length === 0 && !pickerLoading) {
      setPickerLoading(true);
      listGuidelinesLite()
        .then(setGuidelines)
        .catch((err) => setPickerError(err instanceof Error ? err.message : 'Failed to load guidelines'))
        .finally(() => setPickerLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleSubmit = async () => {
    setSubmitError(null);

    if (mode === 'plain') {
      if (!title.trim()) {
        setTitleError('Title is required');
        return;
      }
      setTitleError(null);
    } else if (mode === 'recipe') {
      if (!selectedRecipeId) {
        setSubmitError('Select a recipe');
        return;
      }
    } else if (mode === 'guideline') {
      if (!selectedGuidelineId) {
        setSubmitError('Select a guideline');
        return;
      }
    }

    setSubmitting(true);
    try {
      let created: Task;
      if (mode === 'plain') {
        created = await createTask({ title: title.trim() });
      } else if (mode === 'recipe') {
        created = await generateTaskFromRecipe(selectedRecipeId);
      } else {
        created = await generateTaskFromGuideline(selectedGuidelineId);
      }
      onCreated(created);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog titleId="create-task-dialog-title" onClose={onClose}>
      <h2 id="create-task-dialog-title" className="text-lg font-semibold mb-4">
        New Task
      </h2>

      <div className="flex gap-2 mb-4" role="tablist" aria-label="Task creation mode">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            className={`text-sm px-3 py-2 min-h-[44px] rounded border ${
              mode === m.value ? 'bg-accent text-white border-accent' : 'bg-surface hover:opacity-80'
            }`}
            onClick={() => {
              setMode(m.value);
              setSubmitError(null);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {submitError && <p className="text-danger text-sm mb-3">{submitError}</p>}

      {mode === 'plain' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input
              className="border rounded px-2 py-2 text-sm"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              aria-label="Task title"
              aria-invalid={titleError ? true : undefined}
            />
            {titleError && <span className="text-danger text-xs">{titleError}</span>}
          </label>
        </div>
      )}

      {mode === 'recipe' && (
        <div className="flex flex-col gap-3">
          {pickerLoading ? (
            <p className="text-muted text-sm">Loading recipes…</p>
          ) : pickerError ? (
            <p className="text-danger text-sm">{pickerError}</p>
          ) : recipes.length === 0 ? (
            <p className="text-muted text-sm">No recipes yet.</p>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              Recipe
              <select
                className="border rounded px-2 py-2 text-sm"
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                aria-label="Select recipe"
              >
                <option value="">Select a recipe…</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {mode === 'guideline' && (
        <div className="flex flex-col gap-3">
          {pickerLoading ? (
            <p className="text-muted text-sm">Loading guidelines…</p>
          ) : pickerError ? (
            <p className="text-danger text-sm">{pickerError}</p>
          ) : guidelines.length === 0 ? (
            <p className="text-muted text-sm">No guidelines yet.</p>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              Guideline
              <select
                className="border rounded px-2 py-2 text-sm"
                value={selectedGuidelineId}
                onChange={(e) => setSelectedGuidelineId(e.target.value)}
                aria-label="Select guideline"
              >
                <option value="">Select a guideline…</option>
                {guidelines.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

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
          {submitting ? 'Creating…' : 'Create Task'}
        </button>
      </div>
    </Dialog>
  );
}
