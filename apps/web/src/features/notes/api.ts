import { getToken } from '../../routes/auth';
import type { LinkedEntityType, Note, NoteScope } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message ?? `Request failed (${res.status})`);
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
