import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Tasks (e2e)', () => {
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

  it('AC5: Chef+ can create a Task and assign it to any Kitchen member', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Prep onions', assigneeId: staff.user.id })
      .expect(201);

    expect(res.body.title).toBe('Prep onions');
    expect(res.body.assigneeId).toBe(staff.user.id);
    expect(res.body.status).toBe('TODO');
  });

  it('AC1: PATCHing status moves a Task between kanban columns', async () => {
    const owner = await signupOwner();

    const createRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Chop carrots' })
      .expect(201);

    const patchRes = await request(app.getHttpServer())
      .patch(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(patchRes.body.status).toBe('IN_PROGRESS');
  });

  it('AC2: Staff can check off a checklist item on their own Task', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    const createRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Prep line',
        assigneeId: staff.user.id,
        checklistItems: [{ text: 'Wash veg' }, { text: 'Slice veg' }],
      })
      .expect(201);

    const itemId = createRes.body.checklistItems[0].id;

    const patchRes = await request(app.getHttpServer())
      .patch(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({
        checklistItems: [
          { id: itemId, text: 'Wash veg', done: true },
          {
            id: createRes.body.checklistItems[1].id,
            text: 'Slice veg',
            done: false,
          },
        ],
      })
      .expect(200);

    expect(patchRes.body.checklistItems[0].done).toBe(true);
  });

  it('AC3: Staff cannot reassign a Task to someone else (server-side 403)', async () => {
    const owner = await signupOwner();
    const staffA = await inviteAndAccept(owner.accessToken, 'STAFF');
    const staffB = await inviteAndAccept(owner.accessToken, 'STAFF');

    const createRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Prep line', assigneeId: staffA.user.id })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staffA.accessToken}`)
      .send({ assigneeId: staffB.user.id })
      .expect(403);
  });

  it('Staff cannot update a Task not assigned to them', async () => {
    const owner = await signupOwner();
    const staffA = await inviteAndAccept(owner.accessToken, 'STAFF');
    const staffB = await inviteAndAccept(owner.accessToken, 'STAFF');

    const createRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Prep line', assigneeId: staffA.user.id })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staffB.accessToken}`)
      .send({ status: 'DONE' })
      .expect(403);
  });

  it('Staff cannot create a Task', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ title: 'Should be rejected' })
      .expect(403);
  });

  it('AC3 (list/kanban share data): GET /tasks returns all Tasks for the Kitchen', async () => {
    const owner = await signupOwner();

    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Task A' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Task B' })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const titles = listRes.body.map((t: { title: string }) => t.title);
    expect(titles).toEqual(expect.arrayContaining(['Task A', 'Task B']));
  });

  it('Cross-tenant: a user from another kitchen gets 404 on GET/PATCH of a Task', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();

    const createRes = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ title: 'Kitchen A task' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .send({ status: 'DONE' })
      .expect(404);
  });
});
