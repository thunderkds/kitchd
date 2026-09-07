import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface ExpiringSoonBatch {
  id: string;
  ingredientId: string;
  qty: number;
  expiryDate: string | null;
  location: string | null;
  createdAt: string;
  ingredient: {
    id: string;
    name: string;
    unit: string;
  };
}

async function request<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken() ?? ''}`,
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

export function fetchExpiringSoon(days?: number): Promise<ExpiringSoonBatch[]> {
  const query = days ? `?days=${days}` : '';
  return request<ExpiringSoonBatch[]>(`/inventory/alerts/expiring${query}`);
}
