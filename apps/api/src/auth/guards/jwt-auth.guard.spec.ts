import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function mockContext(headers: Record<string, string> = {}): ExecutionContext {
  const request = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const guard = new JwtAuthGuard(jwtService);

  it('rejects with 401 (not 500) when no Authorization header is present', async () => {
    await expect(guard.canActivate(mockContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects with 401 when the token is malformed', async () => {
    await expect(
      guard.canActivate(
        mockContext({ authorization: 'Bearer not-a-real-jwt' }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects with 401 when the token is empty', async () => {
    await expect(
      guard.canActivate(mockContext({ authorization: 'Bearer ' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows access and attaches payload for a valid token', async () => {
    const token = jwtService.sign({ sub: 'user-1' });
    const context = mockContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
