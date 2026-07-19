import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';
import type { Guideline, GuidelineInput } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

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
    // T029 — fetch rejected outright (network failure), not a non-2xx
    // response. Surface the same shared dialog rather than an unhandled
    // rejection.
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

export function listGuidelines(): Promise<Guideline[]> {
  return request<Guideline[]>('/guidelines');
}

export function getGuideline(id: string): Promise<Guideline> {
  return request<Guideline>(`/guidelines/${id}`);
}

export function createGuideline(input: GuidelineInput): Promise<Guideline> {
  return request<Guideline>('/guidelines', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateGuideline(id: string, input: Partial<GuidelineInput>): Promise<Guideline> {
  return request<Guideline>(`/guidelines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
