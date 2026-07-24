import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Recipes (e2e)', () => {
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

  async function createIngredient(
    ownerToken: string,
    overrides: Partial<{
      name: string;
      unit: string;
      costPerUnit: number;
    }> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: overrides.name ?? 'Flour',
        unit: overrides.unit ?? 'kg',
        costPerUnit: overrides.costPerUnit ?? 1.5,
      })
      .expect(201);
    return res.body as { id: string; costPerUnit: number };
  }

  it('AC1: creating a Recipe with 3 RecipeIngredients returns cost_computed = sum(qty x cost_per_unit)', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken, {
      name: 'Flour',
      costPerUnit: 2,
    });
    const sugar = await createIngredient(owner.accessToken, {
      name: 'Sugar',
      costPerUnit: 3,
    });
    const butter = await createIngredient(owner.accessToken, {
      name: 'Butter',
      costPerUnit: 5,
    });

    const res = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Cake',
        steps: ['Mix', 'Bake'],
        servings: 4,
        ingredients: [
          { ingredientId: flour.id, qty: 2 }, // 2*2=4
          { ingredientId: sugar.id, qty: 1 }, // 3*1=3
          { ingredientId: butter.id, qty: 0.5 }, // 5*0.5=2.5
        ],
      })
      .expect(201);

    expect(res.body.costComputed).toBeCloseTo(9.5);
    expect(res.body.version).toBe(1);
  });

  it('AC2: editing a RecipeIngredient qty recalculates cost_computed', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken, { costPerUnit: 2 });

    const createRes = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Bread',
        steps: ['Knead', 'Bake'],
        ingredients: [{ ingredientId: flour.id, qty: 2 }],
      })
      .expect(201);
    expect(createRes.body.costComputed).toBeCloseTo(4);

    const updateRes = await request(app.getHttpServer())
      .patch(`/recipes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ ingredients: [{ ingredientId: flour.id, qty: 5 }] })
      .expect(200);

    expect(updateRes.body.costComputed).toBeCloseTo(10);
  });

  it('Ingredient cost_per_unit changing after Recipe creation is reflected live on next read', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken, { costPerUnit: 2 });

    const createRes = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Bread',
        steps: ['Knead', 'Bake'],
        ingredients: [{ ingredientId: flour.id, qty: 2 }],
      })
      .expect(201);
    expect(createRes.body.costComputed).toBeCloseTo(4);

    await request(app.getHttpServer())
      .patch(`/ingredients/${flour.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ costPerUnit: 10 })
      .expect(200);

    const readRes = await request(app.getHttpServer())
      .get(`/recipes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    // Live cost, not the cost frozen at creation time.
    expect(readRes.body.costComputed).toBeCloseTo(20);
  });

  it('AC3: editing a Recipe increments its version and preserves prior version data', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken, { costPerUnit: 2 });

    const createRes = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Bread v1',
        steps: ['Knead'],
        ingredients: [{ ingredientId: flour.id, qty: 1 }],
      })
      .expect(201);
    expect(createRes.body.version).toBe(1);

    await request(app.getHttpServer())
      .patch(`/recipes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Bread v2' })
      .expect(200);

    const finalRes = await request(app.getHttpServer())
      .patch(`/recipes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Bread v3' })
      .expect(200);
    expect(finalRes.body.version).toBe(3);

    const versionsRes = await request(app.getHttpServer())
      .get(`/recipes/${createRes.body.id}/versions`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(versionsRes.body).toHaveLength(3);
    const names = versionsRes.body.map((v: { name: string }) => v.name).sort();
    expect(names).toEqual(['Bread v1', 'Bread v2', 'Bread v3']);
    const v1 = versionsRes.body.find(
      (v: { version: number }) => v.version === 1,
    );
    expect(v1.name).toBe('Bread v1');
  });

  it('AC4: Staff can view but not edit a Recipe', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    const flour = await createIngredient(owner.accessToken, { costPerUnit: 2 });

    const createRes = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Bread',
        steps: ['Knead'],
        ingredients: [{ ingredientId: flour.id, qty: 1 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/recipes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({
        name: 'Should be rejected',
        steps: ['x'],
        ingredients: [{ ingredientId: flour.id, qty: 1 }],
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/recipes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ name: 'Should be rejected' })
      .expect(403);
  });

  it('Cross-tenant: a user from another kitchen gets 404 on GET/PATCH of a Recipe', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();
    const flourA = await createIngredient(ownerA.accessToken, {
      costPerUnit: 2,
    });

    const createRes = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({
        name: 'Bread',
        steps: ['Knead'],
        ingredients: [{ ingredientId: flourA.id, qty: 1 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/recipes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/recipes/${createRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .send({ name: 'Should not update' })
      .expect(404);
  });

  it('Edge case: creating a Recipe with an ingredientId that does not exist is rejected (400), not a crash', async () => {
    const owner = await signupOwner();

    await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Ghost Recipe',
        steps: ['x'],
        ingredients: [{ ingredientId: 'non-existent-id', qty: 1 }],
      })
      .expect(400);
  });

  it('Edge case: an ingredient belonging to another kitchen cannot be referenced', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();
    const flourB = await createIngredient(ownerB.accessToken, {
      costPerUnit: 2,
    });

    await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({
        name: 'Cross-tenant recipe',
        steps: ['x'],
        ingredients: [{ ingredientId: flourB.id, qty: 1 }],
      })
      .expect(400);
  });
});
