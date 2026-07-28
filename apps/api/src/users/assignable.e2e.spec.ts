import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * T040 Part A — GET /users/assignable.
 *
 * Written matrix style (role x the new route) rather than as a single happy
 * path: the T019 learning is that per-feature suites miss role-omission gaps.
 */
describe('Assignable users (e2e)', () => {
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

  async function signupOwner(label = 'owner') {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'correct-horse-battery',
        organizationName: `Org ${Date.now()}`,
        kitchenName: `Kitchen ${Date.now()}`,
      })
      .expect(201);
    return {
      email,
      accessToken: res.body.accessToken as string,
      user: res.body.user as { id: string; kitchenId: string },
    };
  }

  async function inviteAndAccept(
    ownerToken: string,
    role: 'CHEF' | 'STAFF' | 'VIEWER',
    label = 'member',
  ) {
    const email = uniqueEmail(label);
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
      .send({ token: invite!.token, password: `${label}-password` })
      .expect(201);

    return {
      email,
      accessToken: acceptRes.body.accessToken as string,
      user: acceptRes.body.user as { id: string; kitchenId: string },
    };
  }

  /** Promotes an existing member to ADMIN — there is no invite/role-change
   * path that grants ADMIN (a documented gap), so the matrix reaches the
   * ADMIN branch via a direct write plus a fresh login. */
  async function loginAsAdmin(member: { email: string; user: { id: string } }) {
    await prisma.user.update({
      where: { id: member.user.id },
      data: { role: 'ADMIN' },
    });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: member.email, password: 'admin-seed-password' })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ---------------------------------------------------------------
  // AC3 (role matrix): who may call GET /users/assignable
  // ---------------------------------------------------------------
  describe('AC3: role x GET /users/assignable', () => {
    it('OWNER is allowed (200)', async () => {
      const owner = await signupOwner();
      await request(app.getHttpServer())
        .get('/users/assignable')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
    });

    it('ADMIN is allowed (200)', async () => {
      const owner = await signupOwner();
      const member = await inviteAndAccept(
        owner.accessToken,
        'STAFF',
        'admin-seed',
      );
      const adminToken = await loginAsAdmin(member);

      await request(app.getHttpServer())
        .get('/users/assignable')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('CHEF is allowed (200)', async () => {
      const owner = await signupOwner();
      const chef = await inviteAndAccept(owner.accessToken, 'CHEF', 'chef');

      await request(app.getHttpServer())
        .get('/users/assignable')
        .set('Authorization', `Bearer ${chef.accessToken}`)
        .expect(200);
    });

    it('STAFF is rejected (403)', async () => {
      const owner = await signupOwner();
      const staff = await inviteAndAccept(owner.accessToken, 'STAFF', 'staff');

      await request(app.getHttpServer())
        .get('/users/assignable')
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .expect(403);
    });

    it('VIEWER is rejected (403)', async () => {
      const owner = await signupOwner();
      const viewer = await inviteAndAccept(
        owner.accessToken,
        'VIEWER',
        'viewer',
      );

      await request(app.getHttpServer())
        .get('/users/assignable')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(403);
    });

    it('an unauthenticated caller is rejected (401)', async () => {
      await request(app.getHttpServer()).get('/users/assignable').expect(401);
    });
  });

  // ---------------------------------------------------------------
  // AC3 (matrix, negative direction): the new route must NOT widen the
  // existing Owner/Admin-only users routes for CHEF.
  // ---------------------------------------------------------------
  it('AC3: CHEF still gets 403 from the existing GET /users and GET /users/invites', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF', 'chef');

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/users/invites')
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .expect(403);
  });

  // ---------------------------------------------------------------
  // AC2: response shape is exactly { id, email }
  // ---------------------------------------------------------------
  it('AC2: every returned object has exactly the keys id and email', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF', 'chef');

    const res = await request(app.getHttpServer())
      .get('/users/assignable')
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    for (const member of res.body) {
      expect(Object.keys(member).sort()).toEqual(['email', 'id']);
    }
  });

  // ---------------------------------------------------------------
  // AC1: a member with zero tasks is still listed, and the caller sees
  // themselves (self-assignment is legitimate).
  // ---------------------------------------------------------------
  it('AC1: a CHEF sees every active member by email, including one with no tasks and themselves', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF', 'chef');
    const taskless = await inviteAndAccept(
      owner.accessToken,
      'STAFF',
      'taskless',
    );

    const res = await request(app.getHttpServer())
      .get('/users/assignable')
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .expect(200);

    const emails = res.body.map((m: { email: string }) => m.email);
    expect(emails).toEqual(
      expect.arrayContaining([owner.email, chef.email, taskless.email]),
    );

    const taskCount = await prisma.task.count({
      where: { assigneeId: taskless.user.id },
    });
    expect(taskCount).toBe(0);
  });

  it('AC1: results are ordered by email ascending', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF', 'chef');

    const res = await request(app.getHttpServer())
      .get('/users/assignable')
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .expect(200);

    const emails = res.body.map((m: { email: string }) => m.email);
    expect(emails).toEqual([...emails].sort());
  });

  // ---------------------------------------------------------------
  // AC4: kitchen scoping + inactive exclusion
  // ---------------------------------------------------------------
  it('AC4: never returns another kitchen member, and never a deactivated member', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF', 'chef');
    const removed = await inviteAndAccept(
      owner.accessToken,
      'STAFF',
      'removed',
    );
    const other = await signupOwner('other');
    const otherMember = await inviteAndAccept(
      other.accessToken,
      'STAFF',
      'other-member',
    );

    await request(app.getHttpServer())
      .delete(`/users/${removed.user.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/users/assignable')
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .expect(200);

    const emails = res.body.map((m: { email: string }) => m.email);
    expect(emails).not.toContain(removed.email);
    expect(emails).not.toContain(other.email);
    expect(emails).not.toContain(otherMember.email);
    expect(emails).toEqual(expect.arrayContaining([owner.email, chef.email]));
  });
});
