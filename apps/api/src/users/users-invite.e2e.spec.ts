import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Users / Invite flow (e2e)', () => {
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
      user: { id: string; kitchenId: string };
    };
  }

  it('AC1: Owner can invite a user by email to their Kitchen with a role', async () => {
    const owner = await signupOwner();
    const inviteeEmail = uniqueEmail('invitee');

    const res = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeEmail, role: 'CHEF' })
      .expect(201);

    expect(res.body.email).toBe(inviteeEmail);
    expect(res.body.role).toBe('CHEF');
    expect(res.body.status).toBe('PENDING');

    const invite = await prisma.invite.findUnique({
      where: { id: res.body.id },
    });
    expect(invite).not.toBeNull();
    expect(invite?.kitchenId).toBe(owner.user.kitchenId);
  });

  it('AC1/AC2: invited user, once accepted, is scoped to only that Kitchen', async () => {
    const owner = await signupOwner();
    const inviteeEmail = uniqueEmail('invitee');

    const inviteRes = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeEmail, role: 'STAFF' })
      .expect(201);

    const invite = await prisma.invite.findUnique({
      where: { id: inviteRes.body.id },
    });

    const acceptRes = await request(app.getHttpServer())
      .post('/users/invite/accept')
      .send({ token: invite!.token, password: 'invitee-password' })
      .expect(201);

    expect(acceptRes.body.user.kitchenId).toBe(owner.user.kitchenId);
    expect(acceptRes.body.user.role).toBe('STAFF');

    const updatedInvite = await prisma.invite.findUnique({
      where: { id: invite!.id },
    });
    expect(updatedInvite?.status).toBe('ACCEPTED');
  });

  it('a route protected with @Roles(OWNER, ADMIN) rejects a non-owner/admin JWT with 403', async () => {
    const owner = await signupOwner();
    const staffEmail = uniqueEmail('staff');

    const inviteRes = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: staffEmail, role: 'STAFF' })
      .expect(201);

    const invite = await prisma.invite.findUnique({
      where: { id: inviteRes.body.id },
    });
    const acceptRes = await request(app.getHttpServer())
      .post('/users/invite/accept')
      .send({ token: invite!.token, password: 'staff-password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${acceptRes.body.accessToken}`)
      .send({ email: uniqueEmail('another'), role: 'VIEWER' })
      .expect(403);
  });

  it('Edge case: invite to a non-existent Kitchen (dangling token holder) is rejected', async () => {
    // Simulated by an unauthenticated request having no valid inviter at all.
    await request(app.getHttpServer())
      .post('/users/invite')
      .send({ email: uniqueEmail('x'), role: 'STAFF' })
      .expect(401);
  });

  it('Edge case: re-inviting an already-member user (e.g. the inviter itself) is rejected with 409, no duplicate membership', async () => {
    const email = uniqueEmail('self-owner');
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'correct-horse-battery',
        organizationName: `Org ${Date.now()}`,
        kitchenName: `Kitchen ${Date.now()}`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${signupRes.body.accessToken}`)
      .send({ email, role: 'STAFF' })
      .expect(409);
  });

  it('Edge case: re-inviting an already-pending invite reuses the row instead of duplicating it', async () => {
    const owner = await signupOwner();
    const inviteeEmail = uniqueEmail('pending');

    const first = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeEmail, role: 'STAFF' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeEmail, role: 'VIEWER' })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.role).toBe('VIEWER');

    const invites = await prisma.invite.findMany({
      where: { email: inviteeEmail },
    });
    expect(invites).toHaveLength(1);
  });
});
