import { useEffect, useState } from 'react';
import { listNotes } from '../../features/notes/api';
import type { Note } from '../../features/notes/types';

const MAX_ITEMS = 5;

/**
 * T018 — thin filter view over T012's GET /notes for the Dashboard.
 * The endpoint already sorts pinned-first (`orderBy: [{pinned: 'desc'},
 * {createdAt: 'desc'}]`), so client-side filtering the team-scope
 * response for `pinned === true` and taking the first N is sufficient —
 * no new backend query param needed. Shape mirrors LowStockWidget: self-
 * fetching, own loading/error/empty states, no props required.
 */
export function PinnedNotesWidget() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listNotes({ scope: 'team' })
      .then((data) => {
        if (!cancelled) setNotes(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pinned = (notes ?? []).filter((note) => note.pinned).slice(0, MAX_ITEMS);

  return (
    <div className="border rounded-lg p-4 w-full" data-testid="pinned-notes-widget">
      <h3 className="text-sm font-semibold text-primary mb-3">Pinned Notes</h3>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {!error && notes === null && <p className="text-sm text-muted">Loading…</p>}

      {!error && notes !== null && pinned.length === 0 && (
        <p className="text-sm text-muted" data-testid="pinned-notes-empty">
          No pinned notes yet.
        </p>
      )}

      {!error && notes !== null && pinned.length > 0 && (
        <ul className="divide-y" data-testid="pinned-notes-list">
          {pinned.map((note) => (
            <li
              key={note.id}
              data-testid={`pinned-note-row-${note.id}`}
              className="px-1 py-2 text-sm"
            >
              {note.title && <p className="font-medium text-primary break-words">{note.title}</p>}
              <p className="text-muted whitespace-pre-wrap break-words">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
