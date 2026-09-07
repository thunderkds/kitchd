import { getToken } from '../../routes/auth';
import type { UserRole, AuthResponseDto } from '@kitchenos/shared';
import { notifyApiError } from '../../errorDialog/ErrorDialogProvider';
import type { Invite, Member } from './types';

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

export type AcceptInviteResult = AuthResponseDto;

/**
 * T043 — `POST /users/invite/accept` is deliberately public (the invitee has
 * no account yet), so the Authorization header `request()` attaches is simply
 * ignored by the server. Creates the user inside the *inviting* kitchen with
 * the invited role and returns a session.
 *
 * 404 covers unknown, already-used, revoked AND expired tokens — the backend
 * collapses them on purpose so the endpoint can't be used to probe which
 * emails were invited. Do not surface a distinct "expired" message.
 */
export function acceptInvite(token: string, password: string): Promise<AcceptInviteResult> {
  return request<AcceptInviteResult>('/users/invite/accept', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

/** Absolute link an Owner/Admin hands to an invitee out-of-band (no mailer exists). */
export function buildInviteLink(token: string): string {
  return `${window.location.origin}/invite/accept?token=${encodeURIComponent(token)}`;
}
