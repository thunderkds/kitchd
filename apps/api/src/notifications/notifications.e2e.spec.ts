import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Notifications (e2e)', () => {
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
      user: { id: string; kitchenId: string; email: string };
    };
  }

  // AC1: mentioning a Kitchen member in a Comment creates a Notification
  // for that recipient (T015 hook into CommentsService#create).
  it('AC1: creates a Notification when the current user is @mentioned', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    const staffLocalPart = staff.user.email.split('@')[0];

    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: 'task-1',
        body: `@${staffLocalPart} please check this`,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);

    expect(res.body.unreadCount).toBe(1);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].type).toBe('MENTION');
  });

  // A comment that mentions nobody (or an unresolved handle) creates no
  // Notification — negative case for the mention hook.
  it('does not create a Notification when no mention resolves', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: 'task-2',
        body: 'no mentions here',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);

    expect(res.body.unreadCount).toBe(0);
  });

  // AC2: opening the bell (mark-read) clears unread count and marks all
  // currently-visible notifications read.
  it('AC2: mark-read clears unread notifications and decrements the count', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    const staffLocalPart = staff.user.email.split('@')[0];

    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        entityType: 'task',
        entityId: 'task-3',
        body: `@${staffLocalPart} ping`,
      })
      .expect(201);

    const before = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);
    expect(before.body.unreadCount).toBe(1);

    await request(app.getHttpServer())
      .post('/notifications/mark-read')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);
    expect(after.body.unreadCount).toBe(0);
    expect(after.body.notifications.every((n: any) => n.read)).toBe(true);
  });

  // AC3: a low-stock alert produces exactly one Notification per
  // Ingredient crossing threshold — not on every subsequent poll, and not
  // twice for a rapid in/out/in oscillation (only the FIRST crossing
  // notifies until it recovers above threshold again).
  it('AC3: low-stock crossing notifies once, not on every poll (dedup)', async () => {
    const owner = await signupOwner();

    const ingredientRes = await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Flour',
        unit: 'kg',
        costPerUnit: 1,
        minThreshold: 5,
      })
      .expect(201);
    const ingredientId = ingredientRes.body.id;

    // Receive stock above threshold, then consume below it.
    await request(app.getHttpServer())
      .post(`/ingredients/${ingredientId}/stock/receive`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ qty: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/ingredients/${ingredientId}/stock/movements`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ type: 'CONSUME', qty: 8 })
      .expect(201);

    // First poll after crossing below threshold (10 - 8 = 2 < 5).
    await request(app.getHttpServer())
      .get('/inventory/alerts/low-stock')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    // Repeated polls while still low must not spam more Notifications.
    await request(app.getHttpServer())
      .get('/inventory/alerts/low-stock')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/inventory/alerts/low-stock')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const lowStockNotifs = res.body.notifications.filter(
      (n: any) => n.type === 'LOW_STOCK',
    );
    expect(lowStockNotifs).toHaveLength(1);
  });
});
