import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Comments (e2e)', () => {
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

  async function signupOwner(emailLabel = 'owner') {
    const email = uniqueEmail(emailLabel);
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
    emailLabel: string,
  ) {
    const email = uniqueEmail(emailLabel);
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
      user: { id: string; kitchenId: string; email: string };
    };
  }

  it('AC1: @mentioning a Kitchen member resolves to their user id', async () => {
    const owner = await signupOwner('owner');
    const bob = await inviteAndAccept(owner.accessToken, 'STAFF', 'bob');
    const bobLocalPart = bob.user.email.split('@')[0];

    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Prep onions' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: `@${bobLocalPart} please check`,
      })
      .expect(201);

    expect(res.body.mentions).toEqual([bob.user.id]);
  });

  it('AC3: @mentioning a non-member does not resolve (mentions stays empty, comment still posts)', async () => {
    const owner = await signupOwner('owner2');

    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Prep carrots' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: '@stranger check this out',
      })
      .expect(201);

    expect(res.body.mentions).toEqual([]);
    expect(res.body.body).toBe('@stranger check this out');
  });

  it('Cross-tenant: @mentioning a same-username user from a DIFFERENT Kitchen does not resolve', async () => {
    const ownerA = await signupOwner('ownerA');
    const ownerB = await signupOwner('ownerB');
    // Invite a member into Kitchen B whose email local-part we'll try to
    // mention from Kitchen A — must NOT resolve across kitchens.
    const memberB = await inviteAndAccept(
      ownerB.accessToken,
      'STAFF',
      'shared-name',
    );
    const localPart = memberB.user.email.split('@')[0];

    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ title: 'Kitchen A task' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: `@${localPart} hello from another kitchen`,
      })
      .expect(201);

    expect(res.body.mentions).toEqual([]);
  });

  it('AC2: a comment thread on one Task is independent from another Task (entityType+entityId scoping), and also independent across entity types', async () => {
    const owner = await signupOwner('owner3');

    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Some task' })
      .expect(201);
    const otherTaskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Another task' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: 'Task comment',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: otherTaskRes.body.id,
        body: 'Other task comment',
      })
      .expect(201);
    // Same entityId reused under a different entityType must be its own
    // independent thread (entityType+entityId scoping, not entityId alone).
    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'recipe',
        entityId: taskRes.body.id,
        body: 'Recipe-typed comment on same id',
      })
      .expect(201);

    const taskThread = await request(app.getHttpServer())
      .get('/comments')
      .query({ entityType: 'task', entityId: taskRes.body.id })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const otherTaskThread = await request(app.getHttpServer())
      .get('/comments')
      .query({ entityType: 'task', entityId: otherTaskRes.body.id })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const recipeTypedThread = await request(app.getHttpServer())
      .get('/comments')
      .query({ entityType: 'recipe', entityId: taskRes.body.id })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(taskThread.body).toHaveLength(1);
    expect(taskThread.body[0].body).toBe('Task comment');
    expect(otherTaskThread.body).toHaveLength(1);
    expect(otherTaskThread.body[0].body).toBe('Other task comment');
    expect(recipeTypedThread.body).toHaveLength(1);
    expect(recipeTypedThread.body[0].body).toBe(
      'Recipe-typed comment on same id',
    );
  });

  it('rejects an unknown entityType', async () => {
    const owner = await signupOwner('owner4');
    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ entityType: 'invoice', entityId: '123', body: 'Bad entity type' })
      .expect(400);
  });

  it('Viewer cannot create a Comment (403)', async () => {
    const owner = await signupOwner('owner5');
    const viewer = await inviteAndAccept(owner.accessToken, 'VIEWER', 'viewer');

    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Viewer test task' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: 'Should be rejected',
      })
      .expect(403);
  });

  it('Staff CAN create a Comment (per FR-018)', async () => {
    const owner = await signupOwner('owner6');
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF', 'staff');

    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Staff test task' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: 'Staff-authored comment',
      })
      .expect(201);
  });

  it('single-level reply threading: a reply resolves under its parent, replying-to-a-reply is rejected', async () => {
    const owner = await signupOwner('owner7');
    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Threading test task' })
      .expect(201);

    const topRes = await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: 'Top-level comment',
      })
      .expect(201);

    const replyRes = await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: 'A reply',
        parentId: topRes.body.id,
      })
      .expect(201);
    expect(replyRes.body.parentId).toBe(topRes.body.id);

    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: 'A reply to a reply',
        parentId: replyRes.body.id,
      })
      .expect(400);
  });

  it('a comment on a since-deleted Task loads without crashing (no FK, informational back-reference)', async () => {
    const owner = await signupOwner('owner8');
    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Temp task for comments' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: 'Linked to a soon-deleted task',
      })
      .expect(201);

    await prisma.task.delete({ where: { id: taskRes.body.id } });

    const listRes = await request(app.getHttpServer())
      .get('/comments')
      .query({ entityType: 'task', entityId: taskRes.body.id })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].entityId).toBe(taskRes.body.id);
  });

  it('only the author may delete their own Comment (403 for others)', async () => {
    const owner = await signupOwner('owner9');
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF', 'staff2');

    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Delete-test task' })
      .expect(201);

    const commentRes = await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: 'Owner-only comment',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/comments/${commentRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(403);
  });

  it('Cross-tenant: a user from another Kitchen gets 404 reading another Kitchen comment thread by id lookup path is not exposed, but delete is 404', async () => {
    const ownerA = await signupOwner('ownerA2');
    const ownerB = await signupOwner('ownerB2');

    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ title: 'Kitchen A task' })
      .expect(201);

    const commentRes = await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({
        entityType: 'task',
        entityId: taskRes.body.id,
        body: 'Kitchen A comment',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/comments/${commentRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(404);
  });
});
