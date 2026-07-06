import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { RealtimeGateway } from './realtime.gateway';

function mockSocket(
  headers: Record<string, string> = {},
  auth: Record<string, unknown> = {},
) {
  const rooms = new Set<string>();
  return {
    handshake: { headers, auth },
    data: {} as Record<string, unknown>,
    join: jest.fn(async (room: string) => {
      rooms.add(room);
    }),
    disconnect: jest.fn(),
    _rooms: rooms,
  };
}

// Runs the same handshake middleware `afterInit` registers, resolving/
// rejecting the way Socket.IO would for a real handshake.
function runMiddleware(
  gateway: RealtimeGateway,
  socket: unknown,
): Promise<void> {
  const server: {
    use: (fn: (s: unknown, next: (err?: Error) => void) => void) => void;
    middleware?: (s: unknown, next: (err?: Error) => void) => void;
  } = {
    use: (fn) => {
      server.middleware = fn;
    },
  };
  gateway.afterInit(server as never);
  return new Promise((resolve, reject) => {
    server.middleware!(socket, (err?: Error) =>
      err ? reject(err) : resolve(),
    );
  });
}

describe('RealtimeGateway', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });

  function buildGateway(userLookup: unknown) {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(userLookup) },
    };
    return {
      gateway: new RealtimeGateway(jwtService, prisma as never),
      prisma,
    };
  }

  // AC2: invalid/expired JWT rejected at handshake (before `connect`).
  it('rejects the handshake for a client with no token', async () => {
    const { gateway } = buildGateway({
      id: 'u1',
      kitchenId: 'k1',
      role: Role.STAFF,
    });
    const socket = mockSocket();

    await expect(runMiddleware(gateway, socket)).rejects.toBeInstanceOf(Error);
  });

  it('rejects the handshake for a malformed/expired token', async () => {
    const { gateway } = buildGateway({
      id: 'u1',
      kitchenId: 'k1',
      role: Role.STAFF,
    });
    const expired = jwtService.sign({ sub: 'u1' }, { expiresIn: -10 });
    const socket = mockSocket({ authorization: `Bearer ${expired}` });

    await expect(runMiddleware(gateway, socket)).rejects.toBeInstanceOf(Error);
  });

  it('rejects the handshake when the user id no longer exists', async () => {
    const { gateway } = buildGateway(null);
    const token = jwtService.sign({ sub: 'gone' });
    const socket = mockSocket({}, { token });

    await expect(runMiddleware(gateway, socket)).rejects.toBeInstanceOf(Error);
  });

  // AC1/AC4: accepted clients join a room scoped to their own Kitchen,
  // read fresh from the DB (not any JWT claim).
  it('accepts a valid handshake and joins the caller into their current DB kitchenId room', async () => {
    const { gateway } = buildGateway({
      id: 'u1',
      kitchenId: 'kitchen-a',
      role: Role.STAFF,
    });
    const token = jwtService.sign({
      sub: 'u1',
      kitchenId: 'stale-kitchen-claim',
    });
    const socket = mockSocket({}, { token });

    await runMiddleware(gateway, socket);
    await gateway.handleConnection(socket as never);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith('kitchen:kitchen-a');
  });

  // AC5: role downgrade mid-session — the gateway's server-side role
  // check always re-reads the DB, so it can never return a role cached
  // at connect time.
  it('getCurrentRole always re-reads the DB, never a cached role', async () => {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'u1', role: Role.CHEF })
          .mockResolvedValueOnce({ id: 'u1', role: Role.STAFF }),
      },
    };
    const gateway = new RealtimeGateway(jwtService, prisma as never);

    await expect(gateway.getCurrentRole('u1')).resolves.toBe(Role.CHEF);
    // Role downgraded in the DB between checks.
    await expect(gateway.getCurrentRole('u1')).resolves.toBe(Role.STAFF);
  });

  it('emits task.updated with a unique eventId to the kitchen room only', () => {
    const { gateway } = buildGateway(null);
    const to = jest.fn().mockReturnThis();
    const emit = jest.fn();
    (gateway as unknown as { server: unknown }).server = { to, emit } as never;

    gateway.emitTaskUpdated('kitchen-a', { id: 'task-1' });

    expect(to).toHaveBeenCalledWith('kitchen:kitchen-a');
    expect(emit).toHaveBeenCalledWith(
      'task.updated',
      expect.objectContaining({
        eventId: expect.any(String),
        task: { id: 'task-1' },
      }),
    );
  });
});
