import { getToken } from '../../routes/auth';
import type { UserRole } from '../../routes/auth';
import type { Invite, Member } from './types';

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

export function listMembers(): Promise<Member[]> {
  return request<Member[]>('/users');
}

export function updateMemberRole(id: string, role: UserRole): Promise<Member> {
  return request<Member>(`/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function removeMember(id: string): Promise<Member> {
  return request<Member>(`/users/${id}`, { method: 'DELETE' });
}

export function listPendingInvites(): Promise<Invite[]> {
  return request<Invite[]>('/users/invites');
}

export function revokeInvite(id: string): Promise<Invite> {
  return request<Invite>(`/users/invites/${id}`, { method: 'DELETE' });
}

export function inviteMember(email: string, role: UserRole): Promise<Invite> {
  return request<Invite>('/users/invite', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}
