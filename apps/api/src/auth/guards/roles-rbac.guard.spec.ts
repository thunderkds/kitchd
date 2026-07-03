import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function mockContext(userId?: string): ExecutionContext {
  const request = { user: userId ? { sub: userId } : undefined };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const buildGuard = (
    requiredRoles: Role[] | undefined,
    userRole: Role | null,
  ) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as Reflector;
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            userRole ? { id: 'user-1', role: userRole } : null,
          ),
      },
    };
    return new RolesGuard(reflector, prisma as never);
  };

  it('allows access when no @Roles metadata is present (no role restriction)', async () => {
    const guard = buildGuard(undefined, Role.STAFF);
    await expect(guard.canActivate(mockContext('user-1'))).resolves.toBe(true);
  });

  it('allows access when the current DB role matches an allowed role', async () => {
    const guard = buildGuard([Role.CHEF], Role.CHEF);
    await expect(guard.canActivate(mockContext('user-1'))).resolves.toBe(true);
  });

  it('rejects with 403 when a Staff-role JWT hits an @Roles(CHEF) route', async () => {
    const guard = buildGuard([Role.CHEF], Role.STAFF);
    await expect(
      guard.canActivate(mockContext('user-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects with 403 when a Viewer-role JWT hits a write route', async () => {
    const guard = buildGuard([Role.OWNER, Role.ADMIN, Role.CHEF], Role.VIEWER);
    await expect(
      guard.canActivate(mockContext('user-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('re-checks the role against current DB state, not a role embedded in the JWT', async () => {
    // No `role` claim on request.user at all — guard must still resolve access
    // purely from the DB lookup.
    const guard = buildGuard([Role.OWNER], Role.OWNER);
    await expect(guard.canActivate(mockContext('user-1'))).resolves.toBe(true);
  });

  it('rejects with 403 when the user was removed after token issuance (no longer in DB)', async () => {
    const guard = buildGuard([Role.STAFF], null);
    await expect(
      guard.canActivate(mockContext('user-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects with 403 when there is no authenticated user on the request', async () => {
    const guard = buildGuard([Role.STAFF], Role.STAFF);
    await expect(guard.canActivate(mockContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('references the ROLES_KEY metadata key used by the @Roles decorator', () => {
    expect(ROLES_KEY).toBe('roles');
  });
});
