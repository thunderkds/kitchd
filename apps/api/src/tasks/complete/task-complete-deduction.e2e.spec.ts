import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

// T011 — Stock deduction on recipe-linked task completion (FR-008).
// Two-step confirm-before-deduct flow: preview (read-only) then confirm
// (applies StockMovement(CONSUME) atomically). See TASK_GUIDE_T011.md.
describe('Task completion stock deduction (e2e)', () => {
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

  // ---- helpers ---------------------------------------------------------

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

  async function createIngredient(ownerToken: string, name = 'Flour') {
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name, unit: 'kg', costPerUnit: 1.5 })
      .expect(201);
    return res.body as { id: string };
  }

  async function receiveStock(
    ownerToken: string,
    ingredientId: string,
    qty: number,
  ) {
    await request(app.getHttpServer())
      .post(`/ingredients/${ingredientId}/stock/receive`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ qty })
      .expect(201);
  }

  async function createRecipe(
    ownerToken: string,
    ingredientId: string,
    qty: number,
    servings: number,
  ) {
    const res = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Recipe ${Date.now()}-${Math.random()}`,
        steps: ['Prep', 'Cook'],
        servings,
        ingredients: [{ ingredientId, qty }],
      })
      .expect(201);
    return res.body as { id: string };
  }

  async function generateTask(ownerToken: string, recipeId: string) {
    const res = await request(app.getHttpServer())
      .post(`/tasks/generate-from-recipe/recipe/${recipeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    return res.body as { id: string; sourceRecipeId: string };
  }

  async function assignTask(
    ownerToken: string,
    taskId: string,
    assigneeId: string,
  ) {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ assigneeId })
      .expect(200);
  }

  async function consumeMovements(ingredientId: string) {
    return prisma.stockMovement.findMany({
      where: { ingredientId, type: 'CONSUME' },
    });
  }

  // ---- AC1: preview is read-only --------------------------------------

  it('AC1: previewing completion of a recipe-linked Task returns computed deductions (qty x servings) and writes nothing', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken);
    await receiveStock(owner.accessToken, flour.id, 10);
    const recipe = await createRecipe(owner.accessToken, flour.id, 2, 3); // 2 x 3 = 6
    const task = await generateTask(owner.accessToken, recipe.id);

    const res = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/preview`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.deductions).toHaveLength(1);
    expect(res.body.deductions[0].ingredientId).toBe(flour.id);
    expect(res.body.deductions[0].deductQty).toBe(6);
    expect(res.body.deductions[0].currentStock).toBe(10);
    expect(res.body.deductions[0].resultingStock).toBe(4);
    expect(res.body.deductions[0].wouldGoNegative).toBe(false);
    expect(res.body.hasNegativeWarning).toBe(false);

    // Read-only: no CONSUME movement created, task not completed.
    expect(await consumeMovements(flour.id)).toHaveLength(0);
    const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
    expect(dbTask?.status).not.toBe('DONE');
  });

  // ---- AC2: confirm applies the deduction ------------------------------

  it('AC2: confirming completion creates StockMovement(CONSUME) matching computed qty and marks the Task DONE', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken);
    await receiveStock(owner.accessToken, flour.id, 10);
    const recipe = await createRecipe(owner.accessToken, flour.id, 2, 3); // 6
    const task = await generateTask(owner.accessToken, recipe.id);

    const res = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/confirm`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(res.body.task.status).toBe('DONE');
    expect(res.body.movements).toHaveLength(1);
    expect(res.body.movements[0].type).toBe('CONSUME');
    expect(res.body.movements[0].qty).toBe(6);
    expect(res.body.movements[0].actorId).toBe(owner.user.id);

    const movements = await consumeMovements(flour.id);
    expect(movements).toHaveLength(1);
    expect(movements[0].qty).toBe(6);
  });

  // ---- AC3: declining leaves stock unchanged ---------------------------

  it('AC3: declining (never confirming) leaves stock unchanged — no StockMovement, Task not DONE', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken);
    await receiveStock(owner.accessToken, flour.id, 10);
    const recipe = await createRecipe(owner.accessToken, flour.id, 2, 3);
    const task = await generateTask(owner.accessToken, recipe.id);

    // User previews then declines: only preview is called, never confirm.
    await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/preview`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(await consumeMovements(flour.id)).toHaveLength(0);
    const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
    expect(dbTask?.status).not.toBe('DONE');
  });

  // ---- AC4: concurrency ------------------------------------------------

  it('AC4: two Tasks sharing an Ingredient confirmed in parallel both persist their deduction (no lost update)', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken);
    await receiveStock(owner.accessToken, flour.id, 100);

    // Two distinct recipes, both consuming the same shared ingredient.
    const recipeA = await createRecipe(owner.accessToken, flour.id, 3, 1); // 3
    const recipeB = await createRecipe(owner.accessToken, flour.id, 4, 1); // 4
    const taskA = await generateTask(owner.accessToken, recipeA.id);
    const taskB = await generateTask(owner.accessToken, recipeB.id);

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/tasks/${taskA.id}/complete/confirm`)
        .set('Authorization', `Bearer ${owner.accessToken}`),
      request(app.getHttpServer())
        .post(`/tasks/${taskB.id}/complete/confirm`)
        .set('Authorization', `Bearer ${owner.accessToken}`),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);

    // Both deductions must survive as independent append-only rows.
    const movements = await consumeMovements(flour.id);
    expect(movements).toHaveLength(2);
    const total = movements.reduce((s, m) => s + m.qty, 0);
    expect(total).toBe(7); // 3 + 4, neither overwritten
  });

  // ---- AC5: RBAC nuance ------------------------------------------------

  it('AC5: a STAFF user without inventory-write permission can still trigger the deduction by completing their own assigned Task', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    const flour = await createIngredient(owner.accessToken);
    await receiveStock(owner.accessToken, flour.id, 10);
    const recipe = await createRecipe(owner.accessToken, flour.id, 1, 2); // 2
    const task = await generateTask(owner.accessToken, recipe.id);
    await assignTask(owner.accessToken, task.id, staff.user.id);

    // Sanity: STAFF is genuinely denied a DIRECT inventory movement.
    await request(app.getHttpServer())
      .post(`/ingredients/${flour.id}/stock/movements`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ type: 'CONSUME', qty: 1 })
      .expect(403);

    // But completing their OWN assigned task DOES apply the deduction.
    const res = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/confirm`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(201);

    expect(res.body.movements).toHaveLength(1);
    expect(res.body.movements[0].actorId).toBe(staff.user.id);
    expect(res.body.movements[0].qty).toBe(2);
  });

  it('AC5 (negative): a STAFF user cannot complete a Task assigned to someone else (403)', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    const flour = await createIngredient(owner.accessToken);
    await receiveStock(owner.accessToken, flour.id, 10);
    const recipe = await createRecipe(owner.accessToken, flour.id, 1, 1);
    const task = await generateTask(owner.accessToken, recipe.id); // unassigned

    await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/confirm`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(403);

    expect(await consumeMovements(flour.id)).toHaveLength(0);
  });

  // ---- Negative-stock warning -----------------------------------------

  it('Negative stock is ALLOWED but flagged: deduction exceeding on-hand warns yet still applies', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken);
    await receiveStock(owner.accessToken, flour.id, 2);
    const recipe = await createRecipe(owner.accessToken, flour.id, 5, 1); // 5 > 2
    const task = await generateTask(owner.accessToken, recipe.id);

    const preview = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/preview`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(preview.body.hasNegativeWarning).toBe(true);
    expect(preview.body.deductions[0].wouldGoNegative).toBe(true);
    expect(preview.body.deductions[0].resultingStock).toBe(-3);

    // Not blocked — confirming still applies the movement.
    const confirm = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/confirm`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(confirm.body.hasNegativeWarning).toBe(true);
    const movements = await consumeMovements(flour.id);
    expect(movements).toHaveLength(1);
    expect(movements[0].qty).toBe(5);
  });

  // ---- Idempotency / double-completion guard --------------------------

  it('Confirming an already-completed Task is rejected (409) — prevents double deduction', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken);
    await receiveStock(owner.accessToken, flour.id, 10);
    const recipe = await createRecipe(owner.accessToken, flour.id, 1, 1);
    const task = await generateTask(owner.accessToken, recipe.id);

    await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/confirm`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/confirm`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(409);

    // Still only one deduction — the double tap did not double-consume.
    expect(await consumeMovements(flour.id)).toHaveLength(1);
  });

  // ---- Non-recipe task -------------------------------------------------

  it('Completing a Task with no sourceRecipeId requires no confirmation and creates no movement', async () => {
    const owner = await signupOwner();

    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Plain task' })
      .expect(201);

    const preview = await request(app.getHttpServer())
      .post(`/tasks/${created.body.id}/complete/preview`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(preview.body.requiresConfirmation).toBe(false);
    expect(preview.body.deductions).toHaveLength(0);

    const confirm = await request(app.getHttpServer())
      .post(`/tasks/${created.body.id}/complete/confirm`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);
    expect(confirm.body.task.status).toBe('DONE');
    expect(confirm.body.movements).toHaveLength(0);
  });

  // ---- Cross-tenant / not found ---------------------------------------

  it('Negative: completing a nonexistent Task returns 404', async () => {
    const owner = await signupOwner();
    await request(app.getHttpServer())
      .post('/tasks/00000000-0000-0000-0000-000000000000/complete/confirm')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(404);
  });

  it('Negative: completing a Task in another Kitchen returns 404 (cross-tenant)', async () => {
    const ownerA = await signupOwner();
    const ownerB = await signupOwner();
    const flour = await createIngredient(ownerA.accessToken);
    await receiveStock(ownerA.accessToken, flour.id, 10);
    const recipe = await createRecipe(ownerA.accessToken, flour.id, 1, 1);
    const task = await generateTask(ownerA.accessToken, recipe.id);

    await request(app.getHttpServer())
      .post(`/tasks/${task.id}/complete/confirm`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(404);
  });
});
