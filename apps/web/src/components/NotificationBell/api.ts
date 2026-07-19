import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';

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

// T029 — fetch() itself can reject outright (network failure) before a
// Response ever exists; wrap each call site so that case also surfaces
// the shared dialog instead of an unhandled rejection (Acceptance
// Criterion 2).
async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    const message = 'Network error — unable to reach the server. Please check your connection and try again.';
    notifyApiError(message);
    throw new Error(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message ?? `Request failed (${res.status})`;
    notifyApiError(message);
    throw new Error(message);
  }
  return data as T;
}

// T016 — NotificationBell's own API client, same local-to-component
// pattern as T015's Comments/api.ts.
export async function fetchNotifications(): Promise<NotificationFeed> {
  const res = await safeFetch(`${API_BASE}/notifications`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
  });
  return handle<NotificationFeed>(res);
}

export async function markNotificationsRead(): Promise<{ unreadCount: number }> {
  const res = await safeFetch(`${API_BASE}/notifications/mark-read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
  });
  return handle<{ unreadCount: number }>(res);
}
