import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';
import type {
  CreateIngredientInput,
  Ingredient,
  ReceiveStockInput,
  StockMovement,
  UpdateIngredientInput,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Mirrors the request<T>() pattern in features/team/api.ts / features/tasks/api.ts
// (T029 notifyApiError wiring — same shape, don't invent a new one).
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

export function listIngredients(): Promise<Ingredient[]> {
  return request<Ingredient[]>('/ingredients');
}

export function createIngredient(input: CreateIngredientInput): Promise<Ingredient> {
  return request<Ingredient>('/ingredients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateIngredient(id: string, input: UpdateIngredientInput): Promise<Ingredient> {
  return request<Ingredient>(`/ingredients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function receiveStock(id: string, input: ReceiveStockInput): Promise<{ batch: unknown; movement: StockMovement }> {
  return request<{ batch: unknown; movement: StockMovement }>(`/ingredients/${id}/stock/receive`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listMovements(id: string): Promise<StockMovement[]> {
  return request<StockMovement[]>(`/ingredients/${id}/stock/movements`);
}

// Derives current on-hand qty by summing the append-only StockMovement
// ledger — mirrors InventoryService#currentStock server-side. No bulk
// stock-per-ingredient endpoint exists (out of scope: no backend changes),
// so this is computed client-side from the per-ingredient movements route.
export function currentStockFromMovements(movements: StockMovement[]): number {
  return movements.reduce((sum, m) => {
    if (m.type === 'RECEIVE' || m.type === 'ADJUST') {
      return sum + m.qty;
    }
    return sum - m.qty;
  }, 0);
}
