import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface LowStockIngredient {
  id: string;
  name: string;
  unit: string;
  minThreshold: number | null;
  currentStock: number;
}

// T007 — read-only low-stock alert feed. Reuses the same fetch shape as
// features/tasks/api.ts; kept local to the widget since T018 (Dashboard)
// will decide how alerts are shared across widgets.
export async function fetchLowStock(): Promise<LowStockIngredient[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/inventory/alerts/low-stock`, {
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
  return data as LowStockIngredient[];
}
