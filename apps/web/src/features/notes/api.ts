import { getToken } from '../../routes/auth';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';
import type { LinkedEntityType, Note, NoteScope } from './types';

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
    // rejection (Acceptance Criterion 2).
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

export function listNotes(options: {
  scope: NoteScope;
  tag?: string;
  q?: string;
}): Promise<Note[]> {
  const params = new URLSearchParams({ scope: options.scope });
  if (options.tag) params.set('tag', options.tag);
  if (options.q) params.set('q', options.q);
  return request<Note[]>(`/notes?${params.toString()}`);
}

export interface CreateNoteInput {
  title?: string;
  body: string;
  tags?: string[];
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string;
}

export function createNote(input: CreateNoteInput): Promise<Note> {
  return request<Note>('/notes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  tags?: string[];
  pinned?: boolean;
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string;
}

export function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
  return request<Note>(`/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteNote(id: string): Promise<{ id: string }> {
  return request<{ id: string }>(`/notes/${id}`, { method: 'DELETE' });
}
