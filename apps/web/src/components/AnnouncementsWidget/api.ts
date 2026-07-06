import { getToken } from '../../routes/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface Announcement {
  id: string;
  kitchenId: string;
  authorId: string;
  title: string;
  body: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
}

// T018 — read-only latest-announcements feed for the Dashboard. GET
// /announcements already returns newest-first (T013), so no extra sort
// is needed here; the widget only slices the first N.
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await fetch(`${API_BASE}/announcements`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message ?? `Request failed (${res.status})`);
  }
  return data as Announcement[];
}
