import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * The single RBAC enforcement point for the whole codebase (per
 * PROJECT_SPEC.md Critical Constraints). Every module that needs a
 * permission check applies `@Roles(...)` and relies on this guard —
 * never an inline `req.user.role === ...` check.
 *
 * The current role is re-read from the database on every request rather
 * than trusted from the JWT payload, so a role change (or removal) takes
 * effect immediately on the next guarded call, not just after re-login.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub?: string } }>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new ForbiddenException('Not authenticated');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }

    return true;
  }
}
