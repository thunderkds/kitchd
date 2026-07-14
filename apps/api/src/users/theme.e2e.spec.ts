import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Theme preference (e2e)', () => {
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

  async function signup() {
    const email = uniqueEmail('theme');
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: 'correct-horse-battery',
        organizationName: `Org ${Date.now()}`,
        kitchenName: `Kitchen ${Date.now()}`,
      })
      .expect(201);
    return { email, accessToken: res.body.accessToken, user: res.body.user };
  }

  it('AC4 / AC5: signup response includes themePreference defaulted to simple', async () => {
    const { user } = await signup();
    expect(user.themePreference).toBe('simple');
  });

  it('Success Criterion 1: authenticated caller can update own theme to dark_neon', async () => {
    const { accessToken, email } = await signup();

    const res = await request(app.getHttpServer())
      .patch('/users/me/theme')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ theme: 'dark_neon' })
      .expect(200);

    expect(res.body.themePreference).toBe('dark_neon');

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.themePreference).toBe('dark_neon');
  });

  it('Success Criterion 2: invalid theme value is rejected with 400 and DB unchanged', async () => {
    const { accessToken, email } = await signup();

    await request(app.getHttpServer())
      .patch('/users/me/theme')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ theme: 'neon-purple' })
      .expect(400);

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.themePreference).toBe('simple');
  });

  it('Success Criterion 3: unauthenticated request is rejected with 401', async () => {
    await request(app.getHttpServer())
      .patch('/users/me/theme')
      .send({ theme: 'dark_neon' })
      .expect(401);
  });

  it('AC6: login response for a pre-existing user reflects their persisted theme, not a caller-supplied id', async () => {
    const { accessToken, email } = await signup();

    await request(app.getHttpServer())
      .patch('/users/me/theme')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ theme: 'dark_neon' })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'correct-horse-battery' })
      .expect(200);

    expect(loginRes.body.user.themePreference).toBe('dark_neon');
  });
});
