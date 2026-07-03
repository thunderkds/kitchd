import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Inventory (e2e)', () => {
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

  async function createIngredient(ownerToken: string) {
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Flour', unit: 'kg', costPerUnit: 1.5 })
      .expect(201);
    return res.body as { id: string };
  }

  it('AC1: Chef can create an Ingredient', async () => {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF');

    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${chef.accessToken}`)
      .send({
        name: 'Sugar',
        unit: 'kg',
        costPerUnit: 2.25,
        category: 'baking',
        allergens: [],
        minThreshold: 5,
      })
      .expect(201);

    expect(res.body.name).toBe('Sugar');
    expect(res.body.kitchenId).toBe(owner.user.kitchenId);
  });

  it('AC1: Chef can edit an Ingredient', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);

    const res = await request(app.getHttpServer())
      .patch(`/ingredients/${ingredient.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ costPerUnit: 3.1 })
      .expect(200);

    expect(res.body.costPerUnit).toBe(3.1);
  });

  it('AC2: Staff gets 403 attempting to edit an Ingredient', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    const ingredient = await createIngredient(owner.accessToken);

    await request(app.getHttpServer())
      .patch(`/ingredients/${ingredient.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ name: 'Should be rejected' })
      .expect(403);
  });

  it('AC2: Staff gets 403 attempting to create an Ingredient', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ name: 'Should be rejected', unit: 'kg', costPerUnit: 1 })
      .expect(403);
  });

  it('AC3 & AC4: receiving stock atomically creates a StockBatch and a StockMovement(RECEIVE) with actor_id and created_at', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);

    const res = await request(app.getHttpServer())
      .post(`/ingredients/${ingredient.id}/stock/receive`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ qty: 10, expiryDate: '2026-12-31', location: 'walk-in' })
      .expect(201);

    expect(res.body.batch.qty).toBe(10);
    expect(res.body.movement.type).toBe('RECEIVE');
    expect(res.body.movement.qty).toBe(10);
    expect(res.body.movement.batchId).toBe(res.body.batch.id);
    expect(res.body.movement.actorId).toBe(owner.user.id);
    expect(res.body.movement.createdAt).toBeTruthy();

    const batchInDb = await prisma.stockBatch.findUnique({
      where: { id: res.body.batch.id },
    });
    const movementInDb = await prisma.stockMovement.findUnique({
      where: { id: res.body.movement.id },
    });
    expect(batchInDb).not.toBeNull();
    expect(movementInDb).not.toBeNull();
  });

  it('Edge case: a StockBatch with expiry_date in the past is accepted, not blocked', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);

    await request(app.getHttpServer())
      .post(`/ingredients/${ingredient.id}/stock/receive`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ qty: 5, expiryDate: '2020-01-01' })
      .expect(201);
  });

  it('AC5: a WASTE movement without a reason is rejected', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);

    await request(app.getHttpServer())
      .post(`/ingredients/${ingredient.id}/stock/movements`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ type: 'WASTE', qty: 2 })
      .expect(400);
  });

  it('AC5: a WASTE movement with a reason succeeds and is attributed to the actor', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);

    const res = await request(app.getHttpServer())
      .post(`/ingredients/${ingredient.id}/stock/movements`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ type: 'WASTE', qty: 2, reason: 'spoiled' })
      .expect(201);

    expect(res.body.reason).toBe('spoiled');
    expect(res.body.actorId).toBe(owner.user.id);
  });

  it('AC5: an ADJUST movement without a reason is rejected', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);

    await request(app.getHttpServer())
      .post(`/ingredients/${ingredient.id}/stock/movements`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ type: 'ADJUST', qty: 3 })
      .expect(400);
  });

  it('Edge case: negative qty on an adjust movement is rejected', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);

    await request(app.getHttpServer())
      .post(`/ingredients/${ingredient.id}/stock/movements`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ type: 'ADJUST', qty: -3, reason: 'correction' })
      .expect(400);
  });

  it('StockMovement is append-only: no PATCH/DELETE route exists', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);
    const movementRes = await request(app.getHttpServer())
      .post(`/ingredients/${ingredient.id}/stock/movements`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ type: 'CONSUME', qty: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(
        `/ingredients/${ingredient.id}/stock/movements/${movementRes.body.id}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ qty: 5 })
      .expect(404);

    await request(app.getHttpServer())
      .delete(
        `/ingredients/${ingredient.id}/stock/movements/${movementRes.body.id}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(404);
  });

  it('AC2 (cross-tenant): a user from another kitchen gets 404 on GET/PATCH of an Ingredient', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();
    const ingredientA = await createIngredient(ownerA.accessToken);

    await request(app.getHttpServer())
      .get(`/ingredients/${ingredientA.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/ingredients/${ingredientA.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .send({ name: 'Should not update' })
      .expect(404);
  });

  it('Edge case: concurrent StockMovement writes to the same Ingredient both persist (no lost update)', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/ingredients/${ingredient.id}/stock/movements`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ type: 'CONSUME', qty: 1 }),
      request(app.getHttpServer())
        .post(`/ingredients/${ingredient.id}/stock/movements`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ type: 'CONSUME', qty: 1 }),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.id).not.toBe(resB.body.id);

    const movements = await prisma.stockMovement.findMany({
      where: { ingredientId: ingredient.id, type: 'CONSUME' },
    });
    expect(movements).toHaveLength(2);
  });
});
