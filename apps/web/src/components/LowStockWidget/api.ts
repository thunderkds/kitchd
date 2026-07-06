import { getToken } from '../../routes/auth';

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
  const res = await fetch(`${API_BASE}/inventory/alerts/low-stock`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message ?? `Request failed (${res.status})`);
  }
  return data as LowStockIngredient[];
}
