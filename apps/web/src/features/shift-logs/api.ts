import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';
import type { CreateShiftLogInput, ShiftLog } from './types';

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

export function listShiftLogs(): Promise<ShiftLog[]> {
  return request<ShiftLog[]>('/shift-logs');
}

export function createShiftLog(input: CreateShiftLogInput): Promise<ShiftLog> {
  return request<ShiftLog>('/shift-logs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
