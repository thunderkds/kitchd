import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';

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
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/announcements`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken() ?? ''}`,
      },
    });
  } catch {
    // T029 — fetch rejected outright (network failure).
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
  return data as Announcement[];
}
