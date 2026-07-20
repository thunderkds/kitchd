import { useState } from 'react';
import { Dialog } from '../../components/Dialog/Dialog';
import { createGuideline, updateGuideline } from './api';
import { GUIDELINE_TYPES } from './types';
import type { Guideline, GuidelineType } from './types';

function toSteps(stepsText: string): string[] {
  return stepsText
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * T037 — create/edit Guideline form, extracted from GuidelinesPage's former
 * full-page-replace branch and wrapped in the shared `Dialog` primitive to
 * match CreateTaskDialog's modal convention. Performs its own create/update
 * network I/O (like CreateTaskDialog); the page only needs the saved result.
 * An absent `guideline` prop means create mode; a present one means edit.
 */
export function GuidelineFormDialog({
  guideline,
  onSaved,
  onClose,
}: {
  guideline?: Guideline | null;
  onSaved: (guideline: Guideline, mode: 'create' | 'edit') => void;
  onClose: () => void;
}) {
  const isEdit = !!guideline;
  const [title, setTitle] = useState(guideline?.title ?? '');
  const [type, setType] = useState<GuidelineType>(guideline?.type ?? 'SOP');
  const [stepsText, setStepsText] = useState(guideline?.steps.join('\n') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    // Preserve the page's prior validation exactly: a blank title is a silent
    // no-op (no network call, no visible error) — not a new error surface.
    if (!title.trim()) return;
    const input = { title: title.trim(), type, steps: toSteps(stepsText) };
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && guideline) {
        const updated = await updateGuideline(guideline.id, input);
        onSaved(updated, 'edit');
      } else {
        const created = await createGuideline(input);
        onSaved(created, 'create');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save guideline');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog titleId="guideline-form-dialog-title" onClose={onClose}>
      <h2 id="guideline-form-dialog-title" className="text-lg font-semibold mb-4">
        {isEdit ? 'Edit Guideline' : 'New Guideline'}
      </h2>
      {error && (
        <p className="text-danger text-sm mb-3" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            className="border rounded px-2 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Guideline title"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            className="border rounded px-2 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as GuidelineType)}
            aria-label="Guideline type"
          >
            {GUIDELINE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Steps (one per line)
          <textarea
            className="border rounded px-2 py-2 text-sm min-h-32"
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            aria-label="Guideline steps"
          />
        </label>
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
          {isEdit ? 'Save Changes' : 'Create Guideline'}
        </button>
      </div>
    </Dialog>
  );
}
