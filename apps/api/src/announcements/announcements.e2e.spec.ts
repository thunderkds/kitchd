import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Announcements (e2e)', () => {
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

    return acceptRes.body as { accessToken: string; user: { id: string } };
  }

  it('AC1: Chef POSTs an Announcement -> visible to other Kitchen members via list/detail', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF');
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    const createRes = await request(app.getHttpServer())
      .post('/announcements')
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .send({ title: 'Fridge #2 down', body: 'Do not use fridge 2 today.' })
      .expect(201);

    expect(createRes.body.title).toBe('Fridge #2 down');
    expect(createRes.body.readBy).toEqual([]);

    const listRes = await request(app.getHttpServer())
      .get('/announcements')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);

    expect(
      (listRes.body as { id: string }[]).some(
        (a) => a.id === createRes.body.id,
      ),
    ).toBe(true);
  });

  it('AC2: Staff GETs the announcement detail -> their id appended to read_by', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    const createRes = await request(app.getHttpServer())
      .post('/announcements')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Team meeting', body: 'Monday 9am.' })
      .expect(201);

    const detailRes = await request(app.getHttpServer())
      .get(`/announcements/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);

    expect(detailRes.body.readBy).toContain(staff.user.id);

    // Reading again does not duplicate the id.
    const secondRes = await request(app.getHttpServer())
      .get(`/announcements/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);

    expect(
      (secondRes.body.readBy as string[]).filter((id) => id === staff.user.id)
        .length,
    ).toBe(1);
  });

  it('AC3: Staff cannot POST an Announcement (403) — only Owner/Chef per FR-021', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .post('/announcements')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ title: 'Should be rejected', body: 'x' })
      .expect(403);
  });

  it('Edge case: an Announcement posted to a Kitchen with zero other members does not error', async () => {
    const owner = await signupOwner();

    const res = await request(app.getHttpServer())
      .post('/announcements')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Solo kitchen memo', body: 'Just me for now.' })
      .expect(201);

    expect(res.body.readBy).toEqual([]);
  });

  it('Cross-tenant: a user from another kitchen gets 404 on GET of an Announcement', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();

    const createRes = await request(app.getHttpServer())
      .post('/announcements')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ title: 'Kitchen A memo', body: 'x' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/announcements/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(404);
  });
});
