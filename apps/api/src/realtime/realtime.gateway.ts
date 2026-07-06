import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Realtime push layer for Tasks/Comments/Announcements (T017). Reuses
 * the same JWT verification as REST (JwtAuthGuard) — no parallel
 * WS-auth scheme, per PROJECT_SPEC.md.
 *
 * Kitchen scoping mirrors the kitchen-scoped-controller pattern: a
 * client is placed in a `kitchen:<id>` room using the kitchenId read
 * fresh from the database at connect time (never trusted from a
 * possibly-stale JWT claim), and every event is emitted only to that
 * room — so a client in a different Kitchen never receives it.
 */
@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:8766' },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // Auth runs as a handshake middleware (not in handleConnection) so an
  // invalid/expired token is rejected with `connect_error` before the
  // client ever observes a `connect` event — matching REST's "rejected
  // at the door" semantics, per AC2.
  afterInit(server: Server): void {
    server.use((socket: Socket, next: (err?: Error) => void) => {
      this.authenticate(socket)
        .then(() => next())
        .catch(() => next(new Error('Unauthorized')));
    });
  }

  private async authenticate(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      throw new Error('Missing token');
    }

    const payload = this.jwtService.verify(token) as { sub?: string };
    if (!payload.sub) {
      throw new Error('Invalid payload');
    }

    // Fresh DB read (not the JWT's kitchenId claim) — same "never trust
    // a possibly-stale claim" rule as RolesGuard.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new Error('User no longer exists');
    }

    client.data.userId = user.id;
    client.data.kitchenId = user.kitchenId;
  }

  async handleConnection(client: Socket): Promise<void> {
    // Middleware above has already authenticated the client and
    // attached client.data — this is only reached for accepted
    // connections, so joining the room here is safe.
    if (client.data.kitchenId) {
      await client.join(this.kitchenRoom(client.data.kitchenId as string));
    }
  }

  handleDisconnect(): void {
    // No server-side state to clean up: room membership is torn down
    // automatically by Socket.IO on disconnect.
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;
    const header = client.handshake.headers?.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private kitchenRoom(kitchenId: string): string {
    return `kitchen:${kitchenId}`;
  }

  /**
   * Re-reads the caller's current role from the database, mirroring
   * RolesGuard's "never trust a cached/stale claim" rule. Any future
   * privileged action delivered over this gateway must call this
   * instead of relying on a role captured at connect time, so a
   * mid-session role downgrade takes effect on the very next check.
   */
  async getCurrentRole(userId: string): Promise<Role | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.role ?? null;
  }

  emitTaskUpdated(
    kitchenId: string,
    task: { id: string; [k: string]: unknown },
  ): void {
    this.server.to(this.kitchenRoom(kitchenId)).emit('task.updated', {
      eventId: crypto.randomUUID(),
      task,
    });
  }

  emitCommentCreated(
    kitchenId: string,
    comment: { id: string; [k: string]: unknown },
  ): void {
    this.server.to(this.kitchenRoom(kitchenId)).emit('comment.created', {
      eventId: crypto.randomUUID(),
      comment,
    });
  }

  emitAnnouncementCreated(
    kitchenId: string,
    announcement: { id: string; [k: string]: unknown },
  ): void {
    this.server.to(this.kitchenRoom(kitchenId)).emit('announcement.created', {
      eventId: crypto.randomUUID(),
      announcement,
    });
  }
}
