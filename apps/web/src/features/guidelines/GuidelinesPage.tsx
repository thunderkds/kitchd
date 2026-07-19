import { useEffect, useState } from 'react';
import { createGuideline, getGuideline, listGuidelines, updateGuideline } from './api';
import { getUser } from '../../routes/auth';
import { GUIDELINE_TYPES } from './types';
import type { Guideline, GuidelineType } from './types';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'];

type ViewMode = 'list' | 'detail' | 'create' | 'edit';

interface GuidelineFormState {
  title: string;
  type: GuidelineType;
  stepsText: string;
}

const EMPTY_FORM: GuidelineFormState = { title: '', type: 'SOP', stepsText: '' };

function toSteps(stepsText: string): string[] {
  return stepsText
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Guidelines page (T032). Consumes T006's `/guidelines` endpoints.
 *
 * GET /guidelines and GET /guidelines/:id are open to any authenticated
 * role (view-only for Staff/Viewer). POST/PATCH are Owner/Admin/Chef-only
 * server-side (`WRITE_ROLES` in guidelines.controller.ts) — this page mirrors
 * that by never attempting a write call for a non-writer caller, not just
 * hiding the controls (T028 pattern).
 */
export function GuidelinesPage() {
  const caller = getUser();
  const canWrite = caller ? WRITE_ROLES.includes(caller.role) : false;

  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [selected, setSelected] = useState<Guideline | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [form, setForm] = useState<GuidelineFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await listGuidelines();
      setGuidelines(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guidelines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (guideline: Guideline) => {
    setError(null);
    try {
      const full = await getGuideline(guideline.id);
      setSelected(full);
      setMode('detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guideline');
    }
  };

  const openCreate = () => {
    if (!canWrite) return;
    setForm(EMPTY_FORM);
    setMode('create');
  };

  const openEdit = (guideline: Guideline) => {
    if (!canWrite) return;
    setForm({
      title: guideline.title,
      type: guideline.type,
      stepsText: guideline.steps.join('\n'),
    });
    setSelected(guideline);
    setMode('edit');
  };

  const backToList = () => {
    setSelected(null);
    setError(null);
    setMode('list');
  };

  const handleSubmit = async () => {
    if (!canWrite) return;
    if (!form.title.trim()) return;
    const input = { title: form.title.trim(), type: form.type, steps: toSteps(form.stepsText) };
    try {
      if (mode === 'edit' && selected) {
        const updated = await updateGuideline(selected.id, input);
        setGuidelines((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        setSelected(updated);
        setMode('detail');
      } else {
        const created = await createGuideline(input);
        setGuidelines((prev) => [created, ...prev]);
        backToList();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save guideline');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Guidelines</h1>
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-xl font-semibold">{mode === 'edit' ? 'Edit Guideline' : 'New Guideline'}</h1>
          <button type="button" className="text-sm px-3 py-1 border rounded" onClick={backToList}>
            Cancel
          </button>
        </div>
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <div className="border rounded p-4 flex flex-col gap-3 max-w-xl">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input
              className="border rounded px-2 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              aria-label="Guideline title"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Type
            <select
              className="border rounded px-2 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as GuidelineType }))}
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
              value={form.stepsText}
              onChange={(e) => setForm((f) => ({ ...f, stepsText: e.target.value }))}
              aria-label="Guideline steps"
            />
          </label>
          <button
            type="button"
            className="self-start px-3 py-2 text-sm rounded bg-accent text-white"
            onClick={handleSubmit}
          >
            {mode === 'edit' ? 'Save Changes' : 'Create Guideline'}
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'detail' && selected) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-xl font-semibold break-words">{selected.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            {canWrite && (
              <button
                type="button"
                className="text-sm px-3 py-1 border rounded"
                onClick={() => openEdit(selected)}
              >
                Edit
              </button>
            )}
            <button type="button" className="text-sm px-3 py-1 border rounded" onClick={backToList}>
              Back
            </button>
          </div>
        </div>
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <p className="text-xs text-muted mb-4">{selected.type}</p>
        {selected.steps.length === 0 ? (
          <p className="text-muted text-sm">No steps yet.</p>
        ) : (
          <ol className="flex flex-col gap-2 list-decimal list-inside" data-testid="guideline-steps">
            {selected.steps.map((step, idx) => (
              <li key={idx} className="border bg-surface-raised rounded p-3 break-words">
                {step}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Guidelines</h1>
        {canWrite && (
          <button
            type="button"
            className="self-start px-3 py-2 text-sm rounded bg-accent text-white"
            onClick={openCreate}
          >
            New Guideline
          </button>
        )}
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      {guidelines.length === 0 ? (
        <p className="text-muted text-sm">No guidelines yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="guidelines-list">
          {guidelines.map((guideline) => (
            <li
              key={guideline.id}
              className="border bg-surface-raised rounded p-3 flex items-center justify-between gap-3 flex-wrap cursor-pointer"
              data-testid={`guideline-${guideline.id}`}
              onClick={() => openDetail(guideline)}
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{guideline.title}</p>
                <p className="text-xs text-muted">{guideline.type}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
