import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';
import type { Recipe, RecipeInput, RecipeVersion } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Mirrors the request<T>() pattern in features/guidelines/api.ts /
// features/inventory/api.ts (T029 notifyApiError wiring — same shape).
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

export function listRecipes(): Promise<Recipe[]> {
  return request<Recipe[]>('/recipes');
}

export function getRecipe(id: string): Promise<Recipe> {
  return request<Recipe>(`/recipes/${id}`);
}

export function listRecipeVersions(id: string): Promise<RecipeVersion[]> {
  return request<RecipeVersion[]>(`/recipes/${id}/versions`);
}

export function createRecipe(input: RecipeInput): Promise<Recipe> {
  return request<Recipe>('/recipes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRecipe(id: string, input: Partial<RecipeInput>): Promise<Recipe> {
  return request<Recipe>(`/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
