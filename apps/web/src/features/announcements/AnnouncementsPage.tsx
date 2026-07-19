import { useEffect, useState } from 'react';
import { createAnnouncement, listAnnouncements } from './api';
import { getUser } from '../../routes/auth';
import type { Announcement } from './types';

/**
 * Announcements page (T033). GET /announcements has no @Roles guard
 * server-side, so unlike T028's Team roster the list fetch itself is not
 * RBAC-restricted — every authenticated kitchen member sees the full
 * history. Only the broadcast (POST) path is gated, to
 * `Owner/Chef only — Admin excluded` per memory/decisions.md's 2026-07-05
 * entry (WRITE_ROLES in announcements.controller.ts), a deliberately
 * narrower shape than Inventory/Guidelines' Owner/Admin/Chef gate.
 */
export function AnnouncementsPage() {
  const caller = getUser();
  const canBroadcast = caller?.role === 'OWNER' || caller?.role === 'CHEF';

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const refresh = async () => {
    try {
      const data = await listAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load announcements');
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBroadcast = async () => {
    // Gate the write call itself, not just the form's visibility (AC5) —
    // Admin/Staff/Viewer never reach this even if invoked programmatically.
    if (!canBroadcast) return;
    if (!title.trim() || !body.trim()) return;
    try {
      const created = await createAnnouncement({ title: title.trim(), body: body.trim() });
      setAnnouncements((prev) => [created, ...(prev ?? [])]);
      setTitle('');
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast announcement');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 w-full" data-testid="announcements-page">
      <h2 className="text-lg font-semibold text-primary mb-4">Announcements</h2>

      {error && (
        <p className="text-sm text-danger mb-3" role="alert">
          {error}
        </p>
      )}

      {canBroadcast && (
        <form
          data-testid="announcement-broadcast-form"
          className="border bg-surface-raised rounded-lg p-4 mb-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleBroadcast();
          }}
        >
          <label htmlFor="announcement-title" className="text-sm font-medium text-primary">
            Title
          </label>
          <input
            id="announcement-title"
            className="border rounded px-2 py-1 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label htmlFor="announcement-body" className="text-sm font-medium text-primary">
            Message
          </label>
          <textarea
            id="announcement-body"
            className="border rounded px-2 py-1 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button
            type="submit"
            className="self-start bg-primary text-on-primary rounded px-3 py-1.5 text-sm font-medium"
          >
            Broadcast
          </button>
        </form>
      )}

      {!error && announcements === null && <p className="text-sm text-muted">Loading…</p>}

      {!error && announcements !== null && announcements.length === 0 && (
        <p className="text-sm text-muted" data-testid="announcements-empty">
          No announcements yet.
        </p>
      )}

      {!error && announcements !== null && announcements.length > 0 && (
        <ul className="divide-y" data-testid="announcements-list">
          {announcements.map((announcement) => (
            <li
              key={announcement.id}
              data-testid={`announcement-row-${announcement.id}`}
              className="px-1 py-3 text-sm"
            >
              <p className="font-medium text-primary break-words">{announcement.title}</p>
              <p className="text-muted whitespace-pre-wrap break-words">{announcement.body}</p>
              <p className="text-xs text-muted mt-1">Read by {announcement.readBy.length}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
