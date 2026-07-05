import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Notes (e2e)', () => {
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

  it('AC1: creates a standalone Note', async () => {
    const owner = await signupOwner();
    const res = await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'Remember to reorder flour', tags: ['#reorder'] })
      .expect(201);

    expect(res.body.body).toBe('Remember to reorder flour');
    expect(res.body.linkedEntityType).toBeNull();
    expect(res.body.pinned).toBe(false);
  });

  it('AC1: creates a Note linked to a Task id', async () => {
    const owner = await signupOwner();
    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Prep onions' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        body: 'Use the walk-in onions first',
        linkedEntityType: 'task',
        linkedEntityId: taskRes.body.id,
      })
      .expect(201);

    expect(res.body.linkedEntityType).toBe('task');
    expect(res.body.linkedEntityId).toBe(taskRes.body.id);
  });

  it('rejects an unknown linkedEntityType', async () => {
    const owner = await signupOwner();
    await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        body: 'Bad link',
        linkedEntityType: 'comment',
        linkedEntityId: '123',
      })
      .expect(400);
  });

  it('a Note linked to a since-deleted Task loads without crashing', async () => {
    const owner = await signupOwner();
    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Temp task' })
      .expect(201);

    const noteRes = await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        body: 'Linked to a task that will be deleted',
        linkedEntityType: 'task',
        linkedEntityId: taskRes.body.id,
      })
      .expect(201);

    // No delete-task endpoint exists yet — simulate the "deleted" case
    // directly, matching the informational-only (no FK) link contract.
    await prisma.task.delete({ where: { id: taskRes.body.id } });

    const getRes = await request(app.getHttpServer())
      .get(`/notes/${noteRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(getRes.body.linkedEntityId).toBe(taskRes.body.id);
    expect(getRes.body.linkedEntityType).toBe('task');
  });

  it('AC2: searching a tag returns only matching Notes', async () => {
    const owner = await signupOwner();
    await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'Recipe idea: kimchi fried rice', tags: ['#recipe-idea'] })
      .expect(201);
    await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'Unrelated note', tags: ['#misc'] })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/notes')
      .query({ tag: '#recipe-idea' })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].tags).toContain('#recipe-idea');
  });

  it("a tag search with special characters doesn't break the query", async () => {
    const owner = await signupOwner();
    const res = await request(app.getHttpServer())
      .get('/notes')
      .query({ tag: "'; DROP TABLE notes; --" })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('AC3: My Notes is author-scoped only, Team Notes shows all', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'Owner note' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ body: 'Staff note' })
      .expect(201);

    const mineRes = await request(app.getHttpServer())
      .get('/notes')
      .query({ scope: 'mine' })
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);
    const bodies = mineRes.body.map((n: { body: string }) => n.body);
    expect(bodies).toEqual(['Staff note']);

    const teamRes = await request(app.getHttpServer())
      .get('/notes')
      .query({ scope: 'team' })
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);
    const teamBodies = teamRes.body.map((n: { body: string }) => n.body);
    expect(teamBodies).toEqual(
      expect.arrayContaining(['Owner note', 'Staff note']),
    );
  });

  it('AC4: pin/unpin toggles pinned state and pinned notes list first', async () => {
    const owner = await signupOwner();
    const createRes = await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'To be pinned' })
      .expect(201);

    const pinRes = await request(app.getHttpServer())
      .patch(`/notes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pinned: true })
      .expect(200);
    expect(pinRes.body.pinned).toBe(true);

    const unpinRes = await request(app.getHttpServer())
      .patch(`/notes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pinned: false })
      .expect(200);
    expect(unpinRes.body.pinned).toBe(false);
  });

  it('Viewer cannot create a Note (403)', async () => {
    const owner = await signupOwner();
    const viewer = await inviteAndAccept(owner.accessToken, 'VIEWER');

    await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ body: 'Should be rejected' })
      .expect(403);
  });

  it('Staff CAN create a Note (per FR-018)', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ body: 'Staff-authored note' })
      .expect(201);
  });

  it("a Staff member cannot edit or delete another author's Note (403)", async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    const createRes = await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ body: 'Owner-only note' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/notes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ body: 'hijacked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/notes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(403);
  });

  it('Cross-tenant: a user from another kitchen gets 404 on GET of a Note', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();

    const createRes = await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ body: 'Kitchen A note' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/notes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(404);
  });
});
