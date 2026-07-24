import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createNote, deleteNote, listNotes, updateNote } from './api';
import { Dialog } from '../../components/Dialog/Dialog';
import { LinkedEntityBadge } from './LinkedEntityBadge';
import type { Note, NoteScope } from './types';

/**
 * Notes list + create modal (T037 modal conversion). My Notes (author-scoped)
 * vs Team Notes (all Notes in the Kitchen) is a server-side `scope` query
 * param, not a client-side filter — the same fetched-once pattern used by
 * Tasks' view/assignee toggle (see features/tasks/TasksPage.tsx).
 *
 * Notes intentionally has NO client-side RBAC gate on note creation — every
 * role (including Viewer) may author a note; the backend is the sole authority
 * (it does not 403 note POSTs). So the "New Note" button is unconditionally
 * visible, matching the prior always-inline create form's visibility exactly.
 */
export function NotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tagQuery, setTagQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newTags, setNewTags] = useState('');

  const scope: NoteScope = searchParams.get('scope') === 'mine' ? 'mine' : 'team';

  const refresh = async () => {
    try {
      const data = await listNotes({ scope, tag: tagQuery || undefined });
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, tagQuery]);

  const setScope = (next: NoteScope) => {
    const params = new URLSearchParams(searchParams);
    params.set('scope', next);
    setSearchParams(params);
  };

  const openForm = () => {
    setNewTitle('');
    setNewBody('');
    setNewTags('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setNewTitle('');
    setNewBody('');
    setNewTags('');
  };

  const handleCreate = async () => {
    if (!newBody.trim()) return;
    const tags = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const created = await createNote({
        title: newTitle || undefined,
        body: newBody,
        tags,
      });
      setNotes((prev) => [created, ...prev]);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    }
  };

  const handleTogglePin = async (note: Note) => {
    const previous = notes;
    setNotes((prev) =>
      prev
        .map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    );
    try {
      await updateNote(note.id, { pinned: !note.pinned });
    } catch (err) {
      setNotes(previous);
      setError(err instanceof Error ? err.message : 'Failed to update note');
    }
  };

  const handleDelete = async (note: Note) => {
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    try {
      await deleteNote(note.id);
    } catch (err) {
      setNotes(previous);
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Notes</h1>
        <div className="flex items-center gap-3">
          <input
            className="border rounded px-2 py-2 text-sm"
            placeholder="Search by tag"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            aria-label="Search by tag"
          />
          <div role="group" aria-label="Notes scope">
            <button
              type="button"
              className={`px-3 py-2 text-sm rounded-l border ${scope === 'mine' ? 'bg-accent text-white' : 'bg-surface-raised'}`}
              onClick={() => setScope('mine')}
            >
              My Notes
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm rounded-r border ${scope === 'team' ? 'bg-accent text-white' : 'bg-surface-raised'}`}
              onClick={() => setScope('team')}
            >
              Team Notes
            </button>
          </div>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded bg-accent text-white"
            onClick={openForm}
          >
            New Note
          </button>
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      {formOpen && (
        <Dialog titleId="note-form-dialog-title" onClose={closeForm}>
          <h2 id="note-form-dialog-title" className="text-lg font-semibold mb-4">
            New Note
          </h2>
          <div className="flex flex-col gap-2">
            <input
              className="border rounded px-2 py-2 text-sm"
              placeholder="Title (optional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              aria-label="Note title"
            />
            <textarea
              className="border rounded px-2 py-2 text-sm"
              placeholder="Write a note..."
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              aria-label="Note body"
            />
            <input
              className="border rounded px-2 py-2 text-sm"
              placeholder="Tags, comma separated (e.g. #recipe-idea)"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              aria-label="Note tags"
            />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded border bg-surface hover:opacity-80"
              onClick={closeForm}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded bg-accent text-white hover:opacity-90"
              onClick={handleCreate}
            >
              Add Note
            </button>
          </div>
        </Dialog>
      )}

      {notes.length === 0 ? (
        <p className="text-muted text-sm">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="notes-list">
          {notes.map((note) => (
            <li key={note.id} className="border bg-surface-raised rounded p-3" data-testid={`note-${note.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {note.title && <p className="font-medium break-words">{note.title}</p>}
                  <p className="text-sm whitespace-pre-wrap break-words">{note.body}</p>
                  {note.tags.length > 0 && (
                    <p className="text-xs text-muted mt-1">{note.tags.join(' ')}</p>
                  )}
                  {note.linkedEntityType && note.linkedEntityId && (
                    <div className="mt-1">
                      <LinkedEntityBadge
                        type={note.linkedEntityType}
                        id={note.linkedEntityId}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => handleTogglePin(note)}
                  >
                    {note.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => handleDelete(note)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
