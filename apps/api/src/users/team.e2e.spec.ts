import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Team management (e2e)', () => {
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

  // ---------------------------------------------------------------
  // AC1: GET /users
  // ---------------------------------------------------------------
  it('AC1: Owner can list own kitchen active members, never another kitchen', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    const other = await signupOwner('other');

    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const emails = res.body.map((m: { email: string }) => m.email);
    expect(emails).toEqual(expect.arrayContaining([owner.email, staff.email]));
    expect(emails).not.toContain(other.email);
    expect(res.body[0].passwordHash).toBeUndefined();
  });

  // ---------------------------------------------------------------
  // AC2: PATCH /users/:id/role — valid + reject Owner/Admin as new role
  // ---------------------------------------------------------------
  it('AC2: Owner changes a Staff member role to CHEF', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    const res = await request(app.getHttpServer())
      .patch(`/users/${staff.user.id}/role`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'CHEF' })
      .expect(200);

    expect(res.body.role).toBe('CHEF');
  });

  it('AC2: requesting OWNER as new role is rejected with 400 (DTO-level)', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .patch(`/users/${staff.user.id}/role`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'OWNER' })
      .expect(400);
  });

  it('AC2: requesting ADMIN as new role is rejected with 400 (DTO-level)', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .patch(`/users/${staff.user.id}/role`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'ADMIN' })
      .expect(400);
  });

  // ---------------------------------------------------------------
  // AC3: cross-tenant -> 404
  // ---------------------------------------------------------------
  it('AC3: role-change targeting a different kitchen returns 404, not 403', async () => {
    const owner = await signupOwner();
    const other = await signupOwner('other');

    await request(app.getHttpServer())
      .patch(`/users/${other.user.id}/role`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'STAFF' })
      .expect(404);
  });

  it('AC3: remove targeting a different kitchen returns 404, not 403', async () => {
    const owner = await signupOwner();
    const other = await signupOwner('other');

    await request(app.getHttpServer())
      .delete(`/users/${other.user.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(404);
  });

  // ---------------------------------------------------------------
  // AC4: cannot target OWNER/ADMIN -> 403
  // ---------------------------------------------------------------
  it("AC4: Admin cannot change another Owner's role (403)", async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    // Promote staff to ADMIN directly (no invite/role-change path grants
    // ADMIN — deliberate, documented gap) purely to exercise this guard.
    await prisma.user.update({
      where: { id: staff.user.id },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: staff.email, password: 'member-password' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/users/${owner.user.id}/role`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({ role: 'STAFF' })
      .expect(403);
  });

  it('AC4: Admin cannot remove/deactivate an Owner (403)', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    await prisma.user.update({
      where: { id: staff.user.id },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: staff.email, password: 'member-password' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/users/${owner.user.id}`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(403);
  });

  // ---------------------------------------------------------------
  // AC5: self-removal -> 400
  // ---------------------------------------------------------------
  it('AC5: Owner cannot remove themselves (400)', async () => {
    const owner = await signupOwner();

    await request(app.getHttpServer())
      .delete(`/users/${owner.user.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
  });

  // ---------------------------------------------------------------
  // AC6/7: soft-deactivation preserves FK integrity, deactivated login 401
  // ---------------------------------------------------------------
  it('AC6/AC7: DELETE soft-deactivates (isActive:false, row intact), FK refs valid, login rejected 401', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    // Give the staff member a historical StockMovement-like FK reference by
    // making them the assignee of a Task (created via direct Prisma write,
    // since Task creation is out of this task's scope to exercise via HTTP).
    const task = await prisma.task.create({
      data: {
        kitchenId: owner.user.kitchenId,
        title: 'Prep station',
        status: 'TODO',
        assigneeId: staff.user.id,
      },
    });

    const res = await request(app.getHttpServer())
      .delete(`/users/${staff.user.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.body.isActive).toBe(false);

    const dbUser = await prisma.user.findUnique({
      where: { id: staff.user.id },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.isActive).toBe(false);

    const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
    expect(dbTask?.assigneeId).toBe(staff.user.id);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: staff.email, password: 'member-password' })
      .expect(401);
  });

  // ---------------------------------------------------------------
  // AC8: GET /users/invites — pending only, own kitchen only
  // ---------------------------------------------------------------
  it('AC8: GET /users/invites lists only own kitchen PENDING invites', async () => {
    const owner = await signupOwner();
    const other = await signupOwner('other');

    const pendingEmail = uniqueEmail('pending');
    await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: pendingEmail, role: 'STAFF' })
      .expect(201);

    // An accepted invite in the owner's kitchen should not show up.
    await inviteAndAccept(owner.accessToken, 'CHEF', 'accepted');

    // Another kitchen's pending invite should not show up.
    await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ email: uniqueEmail('other-pending'), role: 'STAFF' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/users/invites')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe(pendingEmail);
    expect(res.body[0].status).toBe('PENDING');
  });

  // ---------------------------------------------------------------
  // AC9: revoke invite
  // ---------------------------------------------------------------
  it('AC9: revoking a pending invite prevents its later acceptance', async () => {
    const owner = await signupOwner();
    const inviteeEmail = uniqueEmail('revoked');

    const inviteRes = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeEmail, role: 'STAFF' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/users/invites/${inviteRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const invite = await prisma.invite.findUnique({
      where: { id: inviteRes.body.id },
    });
    expect(invite?.status).toBe('REVOKED');

    await request(app.getHttpServer())
      .post('/users/invite/accept')
      .send({ token: invite!.token, password: 'whatever-password' })
      .expect(404);
  });

  it('AC9: revoking an already-revoked invite fails gracefully (409, not 500)', async () => {
    const owner = await signupOwner();
    const inviteeEmail = uniqueEmail('double-revoke');

    const inviteRes = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeEmail, role: 'STAFF' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/users/invites/${inviteRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/users/invites/${inviteRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(409);
  });

  it('AC9: revoking an already-accepted invite fails gracefully (409, not 500)', async () => {
    const owner = await signupOwner();
    const accepted = await inviteAndAccept(
      owner.accessToken,
      'STAFF',
      'to-revoke-accepted',
    );
    const invite = await prisma.invite.findFirst({
      where: { email: accepted.email },
    });

    await request(app.getHttpServer())
      .delete(`/users/invites/${invite!.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(409);
  });

  it('AC9: revoking a nonexistent invite id returns 404, not 500', async () => {
    const owner = await signupOwner();

    await request(app.getHttpServer())
      .delete('/users/invites/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(404);
  });

  // ---------------------------------------------------------------
  // AC10: Chef/Staff/Viewer -> 403 on all 4 new routes (role matrix)
  // ---------------------------------------------------------------
  it('AC10: Chef/Staff/Viewer are rejected with 403 on all 4 new routes', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF', 'chef');
    const viewer = await inviteAndAccept(owner.accessToken, 'VIEWER', 'viewer');

    const inviteRes = await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: uniqueEmail('matrix-pending'), role: 'STAFF' })
      .expect(201);

    for (const nonAdmin of [staff, chef, viewer]) {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${nonAdmin.accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/users/${owner.user.id}/role`)
        .set('Authorization', `Bearer ${nonAdmin.accessToken}`)
        .send({ role: 'STAFF' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/users/${owner.user.id}`)
        .set('Authorization', `Bearer ${nonAdmin.accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/users/invites')
        .set('Authorization', `Bearer ${nonAdmin.accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/users/invites/${inviteRes.body.id}`)
        .set('Authorization', `Bearer ${nonAdmin.accessToken}`)
        .expect(403);
    }
  });
});
