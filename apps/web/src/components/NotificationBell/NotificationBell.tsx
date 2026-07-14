import { useEffect, useState } from 'react';
import {
  fetchNotifications,
  markNotificationsRead,
  type NotificationItem,
} from './api';

/**
 * T016 — bell icon + dropdown feed, mounted in the AppShell Topbar (unlike
 * T007/T012/T015's entity-detail-page-dependent components, this one is
 * genuinely standalone-mountable in the global shell). Fetches on mount;
 * live push arrives later in T017 — this is poll/fetch-on-open only.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchNotifications()
      .then((feed) => {
        setNotifications(feed.notifications);
        setUnreadCount(feed.unreadCount);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      // AC2: opening the bell marks visible notifications read.
      try {
        await markNotificationsRead();
        setUnreadCount(0);
        setNotifications(
          (current) => current?.map((n) => ({ ...n, read: true })) ?? current,
        );
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  return (
    <div className="relative" data-testid="notification-bell">
      <button
        type="button"
        aria-label="Notifications"
        className="relative rounded p-1.5 text-muted hover:text-primary"
        onClick={handleOpen}
        data-testid="notification-bell-button"
      >
        🔔
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
            data-testid="notification-unread-badge"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border bg-surface-raised shadow-lg z-10"
          data-testid="notification-dropdown"
        >
          <div className="border-b px-3 py-2 text-sm font-semibold text-primary">
            Notifications
          </div>

          {error && (
            <p className="px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          {!error && notifications === null && (
            <p className="px-3 py-2 text-sm text-muted">Loading…</p>
          )}

          {!error && notifications !== null && notifications.length === 0 && (
            <p
              className="px-3 py-2 text-sm text-muted"
              data-testid="notification-empty"
            >
              No notifications yet.
            </p>
          )}

          {!error && notifications !== null && notifications.length > 0 && (
            <ul className="max-h-80 divide-y overflow-y-auto" data-testid="notification-list">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="px-3 py-2 text-sm text-primary"
                  data-testid={`notification-${n.id}`}
                >
                  {n.body}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
