import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('ShiftLogs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function signupOwner() {
    const email = uniqueEmail('owner');
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'correct-horse-battery',
        organizationName: `Org ${Date.now()}`,
        kitchenName: `Kitchen ${Date.now()}`,
      })
      .expect(201);
    return res.body as {
      accessToken: string;
      user: { id: string; kitchenId: string; email: string };
    };
  }

  async function inviteAndAccept(
    ownerToken: string,
    role: 'CHEF' | 'STAFF' | 'VIEWER',
  ) {
    const email = uniqueEmail(role.toLowerCase());
    const inviteRes = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email, role })
      .expect(201);

    const invite = await prisma.invite.findUnique({
      where: { id: inviteRes.body.id },
    });

    const acceptRes = await request(app.getHttpServer())
      .post('/users/invite/accept')
      .send({ token: invite!.token, password: 'member-password' })
      .expect(201);

    return acceptRes.body as {
      accessToken: string;
      user: { id: string; kitchenId: string };
    };
  }

  it('AC1/AC3: Staff (non-Viewer) posts a MORNING entry, appears newest-first', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    const createRes = await request(app.getHttpServer())
      .post('/shift-logs')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ shift: 'MORNING', body: 'Prepped the walk-in' })
      .expect(201);

    expect(createRes.body.shift).toBe('MORNING');
    expect(createRes.body.body).toBe('Prepped the walk-in');
    expect(createRes.body.createdAt).toBeDefined();

    const secondRes = await request(app.getHttpServer())
      .post('/shift-logs')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ shift: 'EVENING', body: 'Closed the line' })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/shift-logs')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    // Newest-first: the second-created entry must come before the first.
    const ids = listRes.body.map((s: { id: string }) => s.id);
    expect(ids.indexOf(secondRes.body.id)).toBeLessThan(
      ids.indexOf(createRes.body.id),
    );
  });

  it("AC2: filtering by ?date=YYYY-MM-DD returns only that date's entries", async () => {
    const owner = await signupOwner();

    await request(app.getHttpServer())
      .post('/shift-logs')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ shift: 'MORNING', body: "Today's entry" })
      .expect(201);

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const todayRes = await request(app.getHttpServer())
      .get('/shift-logs')
      .query({ date: today })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(todayRes.body.length).toBeGreaterThanOrEqual(1);
    expect(
      todayRes.body.every((s: { body: string }) => s.body !== undefined),
    ).toBe(true);

    const yesterdayRes = await request(app.getHttpServer())
      .get('/shift-logs')
      .query({ date: yesterday })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(yesterdayRes.body).toEqual([]);
  });

  it('rejects a malformed date filter', async () => {
    const owner = await signupOwner();
    await request(app.getHttpServer())
      .get('/shift-logs')
      .query({ date: 'not-a-date' })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
  });

  it('Viewer cannot post a ShiftLog entry (403)', async () => {
    const owner = await signupOwner();
    const viewer = await inviteAndAccept(owner.accessToken, 'VIEWER');

    await request(app.getHttpServer())
      .post('/shift-logs')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ shift: 'MORNING', body: 'Should be rejected' })
      .expect(403);
  });

  it('rejects an invalid shift enum value', async () => {
    const owner = await signupOwner();
    await request(app.getHttpServer())
      .post('/shift-logs')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ shift: 'NIGHT', body: 'Bad shift value' })
      .expect(400);
  });

  it('a client-supplied createdAt is ignored — server always sets it', async () => {
    const owner = await signupOwner();
    const spoofed = new Date('2099-01-01T00:00:00.000Z').toISOString();

    const res = await request(app.getHttpServer())
      .post('/shift-logs')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ shift: 'MORNING', body: 'Attempted spoof', createdAt: spoofed })
      .expect(201);

    expect(res.body.createdAt).not.toBe(spoofed);
    expect(new Date(res.body.createdAt).getFullYear()).not.toBe(2099);
  });

  it('Cross-tenant: entries from another kitchen never appear in the feed', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();

    await request(app.getHttpServer())
      .post('/shift-logs')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ shift: 'MORNING', body: 'Kitchen A entry' })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/shift-logs')
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(200);

    expect(
      listRes.body.every((s: { body: string }) => s.body !== 'Kitchen A entry'),
    ).toBe(true);
  });
});
