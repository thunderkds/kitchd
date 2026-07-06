import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../app.module';

describe('Realtime gateway (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  const uniqueEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@kitchenos.dev`;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    // Socket.IO needs a real listening HTTP server, not just the
    // in-memory server supertest talks to.
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function signupOwner(label = 'owner') {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'correct-horse-battery',
        organizationName: `Org ${Date.now()}-${label}`,
        kitchenName: `Kitchen ${Date.now()}-${label}`,
      })
      .expect(201);
    return res.body as {
      accessToken: string;
      user: { id: string; kitchenId: string; email: string };
    };
  }

  function connectSocket(token?: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(baseUrl, {
        transports: ['websocket'],
        auth: token ? { token } : {},
        reconnection: false,
        forceNew: true,
      });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
    });
  }

  function waitForEvent(
    socket: Socket,
    event: string,
    timeoutMs = 3000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${event}`)),
        timeoutMs,
      );
      socket.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  // AC2: a client with an invalid/expired JWT is rejected at handshake.
  it('rejects a socket handshake with no token', async () => {
    await expect(connectSocket(undefined)).rejects.toBeDefined();
  });

  it('rejects a socket handshake with a garbage token', async () => {
    await expect(connectSocket('not-a-real-jwt')).rejects.toBeDefined();
  });

  // AC1: a Task status change made by one client is pushed to another
  // client in the same Kitchen.
  it('AC1: pushes a task.updated event to another session in the same Kitchen', async () => {
    const owner = await signupOwner('ac1');
    const socket = await connectSocket(owner.accessToken);

    const createRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Prep onions' })
      .expect(201);

    const eventPromise = waitForEvent(socket, 'task.updated');

    await request(app.getHttpServer())
      .patch(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'DONE' })
      .expect(200);

    const event = (await eventPromise) as {
      eventId: string;
      task: { id: string; status: string };
    };
    expect(event.task.id).toBe(createRes.body.id);
    expect(event.task.status).toBe('DONE');
    expect(typeof event.eventId).toBe('string');

    socket.disconnect();
  });

  // AC4: a client in a different Kitchen never receives another
  // Kitchen's events (tenant isolation via room scoping).
  it('AC4: a client in a different Kitchen does not receive the event', async () => {
    const ownerA = await signupOwner('ac4-a');
    const ownerB = await signupOwner('ac4-b');
    const socketB = await connectSocket(ownerB.accessToken);

    let receivedInB = false;
    socketB.on('task.updated', () => {
      receivedInB = true;
    });

    const createRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ title: 'Kitchen A only task' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ status: 'DONE' })
      .expect(200);

    // Give the (absent) cross-kitchen event a moment to arrive if the
    // isolation were broken.
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(receivedInB).toBe(false);
    socketB.disconnect();
  });

  // AC3: reconnecting does not duplicate previously-received events —
  // the server never buffers/replays past broadcasts, so a client that
  // disconnects and reconnects only ever sees events emitted while it
  // is actually connected, exactly once.
  it('AC3: a reconnected client receives a later event exactly once (no duplicate replay)', async () => {
    const owner = await signupOwner('ac3');
    const createRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Reconnect task' })
      .expect(201);

    const firstSocket = await connectSocket(owner.accessToken);
    firstSocket.disconnect();

    // An update while disconnected must not be queued for delivery later.
    await request(app.getHttpServer())
      .patch(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const reconnected = await connectSocket(owner.accessToken);
    const receivedEventIds: string[] = [];
    reconnected.on('task.updated', (payload: { eventId: string }) => {
      receivedEventIds.push(payload.eventId);
    });

    const eventPromise = waitForEvent(reconnected, 'task.updated');
    await request(app.getHttpServer())
      .patch(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'DONE' })
      .expect(200);
    await eventPromise;

    // Small grace period to make sure no duplicate/backlog delivery follows.
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(receivedEventIds).toHaveLength(1);
    reconnected.disconnect();
  });
});
