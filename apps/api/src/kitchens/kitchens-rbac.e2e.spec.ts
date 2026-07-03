import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Kitchens RBAC (e2e)', () => {
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

  it('AC3: a route protected with @Roles(CHEF) rejects a Staff-role JWT with 403', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .patch(`/kitchens/${owner.user.kitchenId}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ name: 'New Name' })
      .expect(403);
  });

  it('AC3 (positive): a Chef-role JWT is allowed through the @Roles(CHEF) route', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF');

    await request(app.getHttpServer())
      .patch(`/kitchens/${owner.user.kitchenId}`)
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .send({ name: 'Renamed by Chef' })
      .expect(200);
  });

  it('AC5: Viewer role can read but not write on a guarded route', async () => {
    const owner = await signupOwner();
    const viewer = await inviteAndAccept(owner.accessToken, 'VIEWER');

    await request(app.getHttpServer())
      .get(`/kitchens/${owner.user.kitchenId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/kitchens/${owner.user.kitchenId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ name: 'Should be rejected' })
      .expect(403);
  });

  it('Edge case: a JWT for a user removed from the Kitchen after token issuance is rejected on the next guarded call', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF');

    // Remove the chef from the DB directly (e.g. offboarded) while their JWT
    // is still valid/unexpired.
    const chefUser = await prisma.user.findFirst({
      where: { kitchenId: owner.user.kitchenId, role: 'CHEF' },
    });
    await prisma.user.delete({ where: { id: chefUser!.id } });

    await request(app.getHttpServer())
      .patch(`/kitchens/${owner.user.kitchenId}`)
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .send({ name: 'Should be rejected — user no longer exists' })
      .expect(403);
  });

  it('unauthenticated request to a guarded route is rejected with 401', async () => {
    const owner = await signupOwner();
    await request(app.getHttpServer())
      .get(`/kitchens/${owner.user.kitchenId}`)
      .expect(401);
  });

  it('AC2 (P0 regression): a user from kitchen A gets 404 hitting kitchen B GET/PATCH', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();

    await request(app.getHttpServer())
      .get(`/kitchens/${ownerB.user.kitchenId}`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .expect(404);

    const chefA = await inviteAndAccept(ownerA.accessToken, 'CHEF');
    await request(app.getHttpServer())
      .patch(`/kitchens/${ownerB.user.kitchenId}`)
      .set('Authorization', `Bearer ${chefA.accessToken}`)
      .send({ name: 'Should not be renamed' })
      .expect(404);
  });
});
