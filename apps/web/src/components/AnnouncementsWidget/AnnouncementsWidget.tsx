import { useEffect, useState } from 'react';
import { fetchAnnouncements, type Announcement } from './api';

const MAX_ITEMS = 5;

/**
 * T018 — standalone Dashboard widget listing the latest Announcements
 * (T013 was backend-only; this is the first frontend surface for it).
 * Shape mirrors LowStockWidget: self-fetching, own loading/error/empty
 * states, no props required beyond mounting.
 */
export function AnnouncementsWidget() {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnnouncements()
      .then((data) => {
        if (!cancelled) setAnnouncements(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = announcements?.slice(0, MAX_ITEMS) ?? [];

  return (
    <div className="border rounded-lg p-4 w-full" data-testid="announcements-widget">
      <h3 className="text-sm font-semibold text-primary mb-3">Announcements</h3>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {!error && announcements === null && (
        <p className="text-sm text-muted">Loading…</p>
      )}

      {!error && announcements !== null && latest.length === 0 && (
        <p className="text-sm text-muted" data-testid="announcements-empty">
          No announcements yet.
        </p>
      )}

      {!error && announcements !== null && latest.length > 0 && (
        <ul className="divide-y" data-testid="announcements-list">
          {latest.map((announcement) => (
            <li
              key={announcement.id}
              data-testid={`announcement-row-${announcement.id}`}
              className="px-1 py-2 text-sm"
            >
              <p className="font-medium text-primary break-words">{announcement.title}</p>
              <p className="text-muted whitespace-pre-wrap break-words">{announcement.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
