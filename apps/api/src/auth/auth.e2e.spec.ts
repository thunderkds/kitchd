import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const uniqueEmail = () =>
    `test-${Date.now()}-${Math.random().toString(36).slice(2)}@kitchenos.dev`;

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

  it('AC2: signup creates Organization + Kitchen + User and returns a valid JWT', async () => {
    const email = uniqueEmail();

    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'correct-horse-battery',
        organizationName: 'Test Org',
        kitchenName: 'Test Kitchen',
      })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(email);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.organizationId).toBe(res.body.user.organizationId);
    expect(user?.kitchenId).toBe(res.body.user.kitchenId);

    const org = await prisma.organization.findUnique({
      where: { id: user!.organizationId },
    });
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: user!.kitchenId },
    });
    expect(org).not.toBeNull();
    expect(kitchen).not.toBeNull();
  });

  it('AC3: login with correct credentials returns a valid JWT', async () => {
    const email = uniqueEmail();
    const password = 'correct-horse-battery';

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password,
        organizationName: 'Org',
        kitchenName: 'Kitchen',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('AC4: signup with missing password is rejected with a 4xx error', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: uniqueEmail(),
        organizationName: 'Org',
        kitchenName: 'Kitchen',
      })
      .expect(400);
  });

  it('AC4: signup with missing email is rejected with a 4xx error', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        password: 'correct-horse-battery',
        organizationName: 'Org',
        kitchenName: 'Kitchen',
      })
      .expect(400);
  });

  it('AC5: login with wrong password returns 401', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'correct-horse-battery',
        organizationName: 'Org',
        kitchenName: 'Kitchen',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('Edge case: duplicate email signup is rejected without leaving partial rows', async () => {
    const email = uniqueEmail();
    const orgNameA = `Org A ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const orgNameB = `Org B ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'correct-horse-battery',
        organizationName: orgNameA,
        kitchenName: 'Kitchen A',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'correct-horse-battery',
        organizationName: orgNameB,
        kitchenName: 'Kitchen B',
      })
      .expect(409);

    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);

    const orgs = await prisma.organization.findMany({
      where: { name: { in: [orgNameA, orgNameB] } },
    });
    // Only the first successful signup's org should exist — the failed
    // duplicate attempt's org/kitchen must have been rolled back.
    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe(orgNameA);
  });
});
