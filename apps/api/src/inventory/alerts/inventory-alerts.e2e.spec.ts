import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('Inventory Alerts (e2e)', () => {
  let app: INestApplication;

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

  async function createIngredient(
    ownerToken: string,
    overrides: Partial<{ name: string; minThreshold: number }> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: overrides.name ?? 'Flour',
        unit: 'kg',
        costPerUnit: 1.5,
        minThreshold: overrides.minThreshold,
      })
      .expect(201);
    return res.body as { id: string };
  }

  async function receiveStock(
    ownerToken: string,
    ingredientId: string,
    qty: number,
    expiryDate?: string,
  ) {
    return request(app.getHttpServer())
      .post(`/ingredients/${ingredientId}/stock/receive`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ qty, expiryDate })
      .expect(201);
  }

  it('AC1: an Ingredient with stock below min_threshold appears in low-stock', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken, {
      minThreshold: 5,
    });
    await receiveStock(owner.accessToken, ingredient.id, 2);

    const res = await request(app.getHttpServer())
      .get('/inventory/alerts/low-stock')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.body.map((i: { id: string }) => i.id)).toContain(ingredient.id);
    const flagged = res.body.find(
      (i: { id: string }) => i.id === ingredient.id,
    );
    expect(flagged.currentStock).toBe(2);
  });

  it('AC2: an Ingredient at or above min_threshold does not appear', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken, {
      minThreshold: 5,
    });
    await receiveStock(owner.accessToken, ingredient.id, 10);

    const res = await request(app.getHttpServer())
      .get('/inventory/alerts/low-stock')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.body.map((i: { id: string }) => i.id)).not.toContain(
      ingredient.id,
    );
  });

  it('Edge case: min_threshold = 0 never flags as low-stock', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken, {
      minThreshold: 0,
    });
    // No stock received at all — currentStock is 0, which would be "below"
    // a threshold if 0 were treated as a real threshold.

    const res = await request(app.getHttpServer())
      .get('/inventory/alerts/low-stock')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.body.map((i: { id: string }) => i.id)).not.toContain(
      ingredient.id,
    );
  });

  it('AC3: a StockBatch expiring within N days (default 3) appears in expiring-soon', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    await receiveStock(
      owner.accessToken,
      ingredient.id,
      5,
      inTwoDays.toISOString(),
    );

    const res = await request(app.getHttpServer())
      .get('/inventory/alerts/expiring')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(
      res.body.some(
        (batch: { ingredientId: string }) =>
          batch.ingredientId === ingredient.id,
      ),
    ).toBe(true);
  });

  it('A StockBatch expiring beyond N days does not appear', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);
    const inTenDays = new Date();
    inTenDays.setDate(inTenDays.getDate() + 10);
    await receiveStock(
      owner.accessToken,
      ingredient.id,
      5,
      inTenDays.toISOString(),
    );

    const res = await request(app.getHttpServer())
      .get('/inventory/alerts/expiring')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(
      res.body.some(
        (batch: { ingredientId: string }) =>
          batch.ingredientId === ingredient.id,
      ),
    ).toBe(false);
  });

  it('Edge case: a StockBatch with null expiry_date is excluded, not crashed on', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);
    await receiveStock(owner.accessToken, ingredient.id, 5); // no expiryDate

    const res = await request(app.getHttpServer())
      .get('/inventory/alerts/expiring')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(
      res.body.some(
        (batch: { ingredientId: string }) =>
          batch.ingredientId === ingredient.id,
      ),
    ).toBe(false);
  });

  it('supports a configurable ?days= query for expiring-soon', async () => {
    const owner = await signupOwner();
    const ingredient = await createIngredient(owner.accessToken);
    const inTenDays = new Date();
    inTenDays.setDate(inTenDays.getDate() + 10);
    await receiveStock(
      owner.accessToken,
      ingredient.id,
      5,
      inTenDays.toISOString(),
    );

    const res = await request(app.getHttpServer())
      .get('/inventory/alerts/expiring?days=14')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(
      res.body.some(
        (batch: { ingredientId: string }) =>
          batch.ingredientId === ingredient.id,
      ),
    ).toBe(true);
  });

  it('Cross-tenant: alerts only include the caller kitchen ingredients/batches', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();
    const ingredientA = await createIngredient(ownerA.accessToken, {
      minThreshold: 5,
    });
    await receiveStock(ownerA.accessToken, ingredientA.id, 1);

    const res = await request(app.getHttpServer())
      .get('/inventory/alerts/low-stock')
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(200);

    expect(res.body.map((i: { id: string }) => i.id)).not.toContain(
      ingredientA.id,
    );
  });
});
