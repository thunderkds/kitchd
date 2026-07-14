import type { UserRole } from '../../routes/auth';

/** Roles an Owner/Admin can grant via invite or role-change (never Owner/Admin). */
export const ASSIGNABLE_ROLES: UserRole[] = ['CHEF', 'STAFF', 'VIEWER'];

export interface Member {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface Invite {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}
