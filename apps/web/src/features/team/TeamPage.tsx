import { useEffect, useState } from 'react';
import {
  inviteMember,
  listMembers,
  listPendingInvites,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from './api';
import { getUser } from '../../routes/auth';
import type { UserRole } from '../../routes/auth';
import { Dialog } from '../../components/Dialog/Dialog';
import { ASSIGNABLE_ROLES } from './types';
import type { Invite, Member } from './types';

const PROTECTED_ROLES: UserRole[] = ['OWNER', 'ADMIN'];

/**
 * Team & Roles page (T028, modal-converted in T037). Consumes T027's
 * member/invite endpoints.
 *
 * T027's `GET /users` (listMembers) and `GET /users/invites` are
 * Owner/Admin-only server-side (403 for any other caller) — there is no
 * roster endpoint a Chef/Staff/Viewer can call at all. So a non-Owner/Admin
 * caller never fetches team data; the page renders a restricted-access
 * message instead of an empty roster (locked scope decision: "read-only or
 * redirect for non-Owner/Admin", confirmed against the actual T027 RBAC).
 * The invite form now opens via an Owner/Admin-only "Invite Member" button +
 * shared `Dialog` modal instead of rendering always-inline.
 */
export function TeamPage() {
  const caller = getUser();
  const canManage = caller?.role === 'OWNER' || caller?.role === 'ADMIN';

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('STAFF');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const refresh = async () => {
    if (!canManage) return;
    try {
      const [memberData, inviteData] = await Promise.all([listMembers(), listPendingInvites()]);
      setMembers(memberData);
      setInvites(inviteData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRoleChange = async (member: Member, role: UserRole) => {
    const previous = members;
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role } : m)));
    try {
      const updated = await updateMemberRole(member.id, role);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    } catch (err) {
      setMembers(previous);
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRemove = async (member: Member) => {
    const previous = members;
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    try {
      await removeMember(member.id);
    } catch (err) {
      setMembers(previous);
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const openInvite = () => {
    if (!canManage) return;
    setInviteEmail('');
    setInviteRole('STAFF');
    setInviteSuccess(null);
    setInviteOpen(true);
  };

  const closeInvite = () => {
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('STAFF');
  };

  const handleInvite = async () => {
    if (!canManage) return;
    if (!inviteEmail.trim()) return;
    setInviteSuccess(null);
    try {
      const created = await inviteMember(inviteEmail.trim(), inviteRole);
      setInvites((prev) => [created, ...prev]);
      setInviteSuccess(`Invite sent to ${created.email}`);
      closeInvite();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    }
  };

  const handleRevoke = async (invite: Invite) => {
    const previous = invites;
    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    try {
      await revokeInvite(invite.id);
    } catch (err) {
      setInvites(previous);
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  };

  const canManageMember = (member: Member) =>
    canManage && member.id !== caller?.id && !PROTECTED_ROLES.includes(member.role);

  if (!canManage) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-xl font-semibold">Team &amp; Roles</h1>
        </div>
        <p className="text-muted text-sm">
          Team management is available to Owners and Admins only.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Team &amp; Roles</h1>
        {canManage && (
          <button
            type="button"
            className="self-start px-3 py-2 text-sm rounded bg-accent text-white"
            onClick={openInvite}
          >
            Invite Member
          </button>
        )}
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}
      {inviteSuccess && <p className="text-sm text-primary mb-3">{inviteSuccess}</p>}

      {canManage && inviteOpen && (
        <Dialog titleId="invite-member-dialog-title" onClose={closeInvite}>
          <h2 id="invite-member-dialog-title" className="text-lg font-semibold mb-4">
            Invite a member
          </h2>
          <div className="flex flex-col gap-2">
            <input
              className="border rounded px-2 py-2 text-sm"
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              aria-label="Invite email"
            />
            <select
              className="border rounded px-2 py-2 text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              aria-label="Invite role"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded border bg-surface hover:opacity-80"
              onClick={closeInvite}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded bg-accent text-white hover:opacity-90"
              onClick={handleInvite}
            >
              Send Invite
            </button>
          </div>
        </Dialog>
      )}

      <h2 className="text-sm font-medium mb-2">Members</h2>
      {members.length === 0 ? (
        <p className="text-muted text-sm mb-6">No members yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-6" data-testid="members-list">
          {members.map((member) => (
            <li
              key={member.id}
              className="border bg-surface-raised rounded p-3 flex items-center justify-between gap-3 flex-wrap"
              data-testid={`member-${member.id}`}
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{member.email}</p>
                <p className="text-xs text-muted">{member.role}</p>
              </div>
              {canManageMember(member) && (
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    className="border rounded px-2 py-1 text-xs"
                    value={member.role}
                    aria-label={`Change role for ${member.email}`}
                    onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded text-danger"
                    onClick={() => handleRemove(member)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <>
          <h2 className="text-sm font-medium mb-2">Pending Invites</h2>
          {invites.length === 0 ? (
            <p className="text-muted text-sm">No pending invites.</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="invites-list">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="border bg-surface-raised rounded p-3 flex items-center justify-between gap-3 flex-wrap"
                  data-testid={`invite-${invite.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium break-words">{invite.email}</p>
                    <p className="text-xs text-muted">{invite.role}</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded text-danger shrink-0"
                    onClick={() => handleRevoke(invite)}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
