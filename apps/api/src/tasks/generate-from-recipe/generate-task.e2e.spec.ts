import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

describe('Generate Task from Recipe/Guideline (e2e)', () => {
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

  async function createIngredient(ownerToken: string) {
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Flour', unit: 'kg', costPerUnit: 1.5 })
      .expect(201);
    return res.body as { id: string };
  }

  it('AC1/AC2: generating from a Recipe creates a Task with matching checklist and source_recipe_id set', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken);

    const recipeRes = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Cake',
        steps: ['Mix batter', 'Preheat oven', 'Bake 30 min', 'Cool', 'Frost'],
        ingredients: [{ ingredientId: flour.id, qty: 1 }],
      })
      .expect(201);

    const taskRes = await request(app.getHttpServer())
      .post(`/tasks/generate-from-recipe/recipe/${recipeRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(taskRes.body.checklistItems).toHaveLength(5);
    expect(
      taskRes.body.checklistItems.map((i: { text: string }) => i.text),
    ).toEqual(['Mix batter', 'Preheat oven', 'Bake 30 min', 'Cool', 'Frost']);
    expect(taskRes.body.sourceRecipeId).toBe(recipeRes.body.id);
    expect(taskRes.body.sourceGuidelineId).toBeNull();
  });

  it('AC3: generating from a Guideline creates a Task with matching checklist and source_guideline_id set (no source_recipe_id)', async () => {
    const owner = await signupOwner();

    const guidelineRes = await request(app.getHttpServer())
      .post('/guidelines')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Opening Checklist',
        type: 'CHECKLIST',
        steps: ['Unlock', 'Turn on lights', 'Check fridge temps'],
      })
      .expect(201);

    const taskRes = await request(app.getHttpServer())
      .post(`/tasks/generate-from-recipe/guideline/${guidelineRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(taskRes.body.checklistItems).toHaveLength(3);
    expect(
      taskRes.body.checklistItems.map((i: { text: string }) => i.text),
    ).toEqual(['Unlock', 'Turn on lights', 'Check fridge temps']);
    expect(taskRes.body.sourceGuidelineId).toBe(guidelineRes.body.id);
    expect(taskRes.body.sourceRecipeId).toBeNull();
  });

  it('Edge case: editing the Recipe after generation does not retroactively change the generated Task checklist snapshot', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken);

    const recipeRes = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Soup',
        steps: ['Chop veg', 'Simmer'],
        ingredients: [{ ingredientId: flour.id, qty: 1 }],
      })
      .expect(201);

    const taskRes = await request(app.getHttpServer())
      .post(`/tasks/generate-from-recipe/recipe/${recipeRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/recipes/${recipeRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ steps: ['Chop veg', 'Simmer', 'Season', 'Serve'] })
      .expect(200);

    const refetchedTask = await prisma.task.findUnique({
      where: { id: taskRes.body.id },
    });

    expect(refetchedTask?.checklistItems).toHaveLength(2);
    expect(
      (refetchedTask?.checklistItems as Array<{ text: string }>).map(
        (i) => i.text,
      ),
    ).toEqual(['Chop veg', 'Simmer']);
  });

  it('Negative: generating from a nonexistent Recipe id returns 404', async () => {
    const owner = await signupOwner();

    await request(app.getHttpServer())
      .post(
        '/tasks/generate-from-recipe/recipe/00000000-0000-0000-0000-000000000000',
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(404);
  });

  it('Negative: generating from a Recipe belonging to another Kitchen returns 404 (cross-tenant)', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();
    const flour = await createIngredient(ownerA.accessToken);

    const recipeRes = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({
        name: 'Secret Recipe',
        steps: ['Step one'],
        ingredients: [{ ingredientId: flour.id, qty: 1 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tasks/generate-from-recipe/recipe/${recipeRes.body.id}`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(404);
  });
});
