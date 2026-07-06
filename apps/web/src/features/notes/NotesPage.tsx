import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createNote, deleteNote, listNotes, updateNote } from './api';
import { LinkedEntityBadge } from './LinkedEntityBadge';
import type { Note, NoteScope } from './types';

/**
 * Notes list + inline editor. My Notes (author-scoped) vs Team Notes
 * (all Notes in the Kitchen) is a server-side `scope` query param, not
 * a client-side filter — the same fetched-once pattern used by
 * Tasks' view/assignee toggle (see features/tasks/TasksPage.tsx).
 */
export function NotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tagQuery, setTagQuery] = useState('');
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
      setNewTitle('');
      setNewBody('');
      setNewTags('');
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
              className={`px-3 py-2 text-sm rounded-l border ${scope === 'mine' ? 'bg-gray-800 text-white' : 'bg-white'}`}
              onClick={() => setScope('mine')}
            >
              My Notes
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm rounded-r border ${scope === 'team' ? 'bg-gray-800 text-white' : 'bg-white'}`}
              onClick={() => setScope('team')}
            >
              Team Notes
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="border rounded p-4 mb-6 flex flex-col gap-2 max-w-xl">
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
        <button
          type="button"
          className="self-start px-3 py-2 text-sm rounded bg-gray-800 text-white"
          onClick={handleCreate}
        >
          Add Note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-gray-500 text-sm">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="notes-list">
          {notes.map((note) => (
            <li key={note.id} className="border rounded p-3" data-testid={`note-${note.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {note.title && <p className="font-medium break-words">{note.title}</p>}
                  <p className="text-sm whitespace-pre-wrap break-words">{note.body}</p>
                  {note.tags.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{note.tags.join(' ')}</p>
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
