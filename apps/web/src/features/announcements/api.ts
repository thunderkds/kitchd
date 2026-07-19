import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';
import type { Announcement } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Same request<T>() shape as features/team/api.ts, wired to T029's
// global ErrorDialogProvider (notifyApiError). Built as this page's own
// full client rather than importing components/AnnouncementsWidget/api.ts,
// which is a separate scoped read-only client (per TASK_GUIDE_T033).
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken() ?? ''}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    const message = 'Network error — unable to reach the server. Please check your connection and try again.';
    notifyApiError(message);
    throw new Error(message);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message ?? `Request failed (${res.status})`;
    notifyApiError(message);
    throw new Error(message);
  }
  return data as T;
}

// GET /announcements has no @Roles guard server-side (every authenticated
// kitchen member can read) — unlike T028's Team roster, the fetch itself
// is not RBAC-restricted, only the write path (POST) is.
export function listAnnouncements(): Promise<Announcement[]> {
  return request<Announcement[]>('/announcements');
}

// @Roles(OWNER, CHEF) server-side — Admin excluded (memory/decisions.md
// 2026-07-05). Callers must gate invocation client-side too (AC5).
export function createAnnouncement(input: { title: string; body: string }): Promise<Announcement> {
  return request<Announcement>('/announcements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
