import { getToken } from '../../routes/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export type NotificationType = 'MENTION' | 'LOW_STOCK' | 'TASK_ASSIGNED';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  notifications: NotificationItem[];
  unreadCount: number;
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

// T016 — NotificationBell's own API client, same local-to-component
// pattern as T015's Comments/api.ts.
export async function fetchNotifications(): Promise<NotificationFeed> {
  const res = await fetch(`${API_BASE}/notifications`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
  });
  return handle<NotificationFeed>(res);
}

export async function markNotificationsRead(): Promise<{ unreadCount: number }> {
  const res = await fetch(`${API_BASE}/notifications/mark-read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
  });
  return handle<{ unreadCount: number }>(res);
}
