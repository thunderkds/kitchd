import { IsIn } from 'class-validator';
import { Role } from '@prisma/client';
import { INVITABLE_ROLES } from './invite-user.dto';

/**
 * Roles an Owner/Admin is allowed to assign via role-change — same
 * restricted set as invite-time (never Owner/Admin). Enforced at the DTO
 * layer via @IsIn, not only a runtime service check, so an OWNER/ADMIN
 * value is rejected with 400 before any service logic runs.
 */
export class UpdateRoleDto {
  @IsIn(INVITABLE_ROLES)
  role!: Role;
}
