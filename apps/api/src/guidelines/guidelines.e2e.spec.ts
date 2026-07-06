import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Guidelines (e2e)', () => {
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

    return acceptRes.body as { accessToken: string };
  }

  it('AC1: Chef POSTs a Guideline with 4 ordered steps -> 201, steps stored in order', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF');

    const res = await request(app.getHttpServer())
      .post('/guidelines')
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .send({
        title: 'Opening Checklist',
        type: 'CHECKLIST',
        steps: [
          'Unlock',
          'Turn on lights',
          'Check fridge temps',
          'Prep station',
        ],
      })
      .expect(201);

    expect(res.body.steps).toEqual([
      'Unlock',
      'Turn on lights',
      'Check fridge temps',
      'Prep station',
    ]);
    expect(res.body.type).toBe('CHECKLIST');
  });

  it('AC2: Staff can view but not create/edit a Guideline', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    const createRes = await request(app.getHttpServer())
      .post('/guidelines')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Sanitation Procedure',
        type: 'SOP',
        steps: ['Wash hands', 'Sanitize surfaces'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/guidelines/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/guidelines')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ title: 'Should be rejected', type: 'SOP', steps: [] })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/guidelines/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ title: 'Should be rejected' })
      .expect(403);
  });

  it('AC3: GET /guidelines?type=SOP only returns SOP-type Guidelines', async () => {
    const owner = await signupOwner();

    await request(app.getHttpServer())
      .post('/guidelines')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Sanitation SOP', type: 'SOP', steps: ['Step 1'] })
      .expect(201);

    await request(app.getHttpServer())
      .post('/guidelines')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Opening Checklist',
        type: 'CHECKLIST',
        steps: ['Step 1'],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/guidelines?type=SOP')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(
      (res.body as { type: string }[]).every((g) => g.type === 'SOP'),
    ).toBe(true);
  });

  it('GET /guidelines?type=<invalid> returns a clean 400, not a 500', async () => {
    const owner = await signupOwner();

    await request(app.getHttpServer())
      .get('/guidelines?type=NOT_A_REAL_TYPE')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
  });

  it('Edge case: an empty steps array is accepted (draft Guideline)', async () => {
    const owner = await signupOwner();

    const res = await request(app.getHttpServer())
      .post('/guidelines')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Draft SOP', type: 'SOP', steps: [] })
      .expect(201);

    expect(res.body.steps).toEqual([]);
  });

  it('Cross-tenant: a user from another kitchen gets 404 on GET/PATCH of a Guideline', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();

    const createRes = await request(app.getHttpServer())
      .post('/guidelines')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ title: 'SOP A', type: 'SOP', steps: ['x'] })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/guidelines/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/guidelines/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .send({ title: 'Should not update' })
      .expect(404);
  });
});
