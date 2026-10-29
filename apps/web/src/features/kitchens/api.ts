import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface Kitchen {
  id: string;
  name: string;
}

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

export function getKitchen(kitchenId: string): Promise<Kitchen> {
  return request<Kitchen>(`/kitchens/${kitchenId}`);
}

export function renameKitchen(kitchenId: string, name: string): Promise<Kitchen> {
  return request<Kitchen>(`/kitchens/${kitchenId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}
