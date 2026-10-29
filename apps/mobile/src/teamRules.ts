import type { UserRole } from '@kitchenos/shared';

// M017 — client mirror of apps/api users.service.ts. These only HIDE controls; the server
// (RolesGuard + PROTECTED_ROLES + self-removal check) stays the authority.

/** Roles assignable via role-change (UpdateRoleDto @IsIn(INVITABLE_ROLES)) — never OWNER/ADMIN. */
export const ASSIGNABLE_ROLES: readonly UserRole[] = ['CHEF', 'STAFF', 'VIEWER'];

/** Roles the service refuses to change or remove (PROTECTED_ROLES). */
const PROTECTED_ROLES: readonly UserRole[] = ['OWNER', 'ADMIN'];

/** `/users` routes are @Roles(OWNER, ADMIN) — a flat includes, no hierarchy. */
export function canManageTeam(role: UserRole | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/** Same rule as web TeamPage.canManageMember: not self, not an OWNER/ADMIN row. */
export function canManageMember(
  caller: { id: string; role: UserRole } | null | undefined,
  member: { id: string; role: UserRole },
): boolean {
  return (
    !!caller && canManageTeam(caller.role) && member.id !== caller.id && !PROTECTED_ROLES.includes(member.role)
  );
}
