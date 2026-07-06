import { IsEmail, IsIn } from 'class-validator';
import { Role } from '@prisma/client';

/** Roles an Owner/Admin is allowed to grant via invite — never Owner/Admin itself. */
export const INVITABLE_ROLES = [Role.CHEF, Role.STAFF, Role.VIEWER] as const;

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsIn(INVITABLE_ROLES)
  role!: Role;
}
