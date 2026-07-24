import { useEffect, useState } from 'react';
import { getGuideline, listGuidelines } from './api';
import { GuidelineFormDialog } from './GuidelineFormDialog';
import { getUser } from '../../routes/auth';
import type { Guideline } from './types';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'];

type ViewMode = 'list' | 'detail';

/**
 * Guidelines page (T032, modal-converted in T037). Consumes T006's
 * `/guidelines` endpoints.
 *
 * GET /guidelines and GET /guidelines/:id are open to any authenticated
 * role (view-only for Staff/Viewer). POST/PATCH are Owner/Admin/Chef-only
 * server-side (`WRITE_ROLES` in guidelines.controller.ts) — this page mirrors
 * that by never attempting a write call for a non-writer caller, not just
 * hiding the controls (T028 pattern). Create/edit now open the shared
 * `Dialog` modal (GuidelineFormDialog) instead of replacing the page.
 */
export function GuidelinesPage() {
  const caller = getUser();
  const canWrite = caller ? WRITE_ROLES.includes(caller.role) : false;

  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [selected, setSelected] = useState<Guideline | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Guideline | null>(null);
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
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (guideline: Guideline) => {
    if (!canWrite) return;
    setEditing(guideline);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSaved = (saved: Guideline, savedMode: 'create' | 'edit') => {
    if (savedMode === 'edit') {
      setGuidelines((prev) => prev.map((g) => (g.id === saved.id ? saved : g)));
      setSelected((prev) => (prev && prev.id === saved.id ? saved : prev));
    } else {
      setGuidelines((prev) => [saved, ...prev]);
    }
  };

  const backToList = () => {
    setSelected(null);
    setError(null);
    setMode('list');
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Guidelines</h1>
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  const formDialog =
    canWrite && formOpen ? (
      <GuidelineFormDialog guideline={editing} onSaved={handleSaved} onClose={closeForm} />
    ) : null;

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
        {formDialog}
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
      {formDialog}
    </div>
  );
}
