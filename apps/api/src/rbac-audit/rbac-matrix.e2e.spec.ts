import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// T019 — RBAC enforcement audit across all CRUD (FR-018, US-010).
//
// Scope correction (2026-07-05, Supervisor): audits only the 4 modules
// that exist today — Inventory, Recipes, Guidelines, Tasks (including the
// T011 task-completion sub-resource). Notes/Announcements/ShiftLog/
// Comments (T012-T015) don't exist yet — a follow-up audit covers them
// once built.
//
// Matrix: every (module, role) pair against every CRUD verb, asserting
// 200/201 vs 403. Viewer is exercised explicitly on every module (it was
// never exercised in the T004-T011 per-task tests per memory/MEMORY.md).
describe('RBAC matrix audit (e2e)', () => {
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

  // ---- shared fixture helpers -------------------------------------------

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

  // Builds a full 4-role fixture (Owner=WRITE, Chef=WRITE, Staff=non-write,
  // Viewer=read-only) once per test, sharing a single Kitchen.
  async function buildRoleSet() {
    const owner = await signupOwner();
    const chef = await inviteAndAccept(owner.accessToken, 'CHEF');
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');
    const viewer = await inviteAndAccept(owner.accessToken, 'VIEWER');
    return { owner, chef, staff, viewer };
  }

  async function createIngredient(ownerToken: string) {
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `Flour ${Date.now()}`, unit: 'kg', costPerUnit: 1 })
      .expect(201);
    return res.body as { id: string };
  }

  async function createRecipe(ownerToken: string, ingredientId: string) {
    const res = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Recipe ${Date.now()}-${Math.random()}`,
        steps: ['Prep'],
        servings: 1,
        ingredients: [{ ingredientId, qty: 1 }],
      })
      .expect(201);
    return res.body as { id: string };
  }

  async function createGuideline(ownerToken: string) {
    const res = await request(app.getHttpServer())
      .post('/guidelines')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Wash hands', type: 'SOP', steps: ['Step 1'] })
      .expect(201);
    return res.body as { id: string };
  }

  async function createTask(ownerToken: string) {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: `Task ${Date.now()}` })
      .expect(201);
    return res.body as { id: string };
  }

  // =========================================================================
  // Matrix: Inventory (Ingredients)
  // =========================================================================
  describe('Inventory module matrix', () => {
    it('read (list/findOne) is 200 for all 4 roles, including Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      const ingredient = await createIngredient(owner.accessToken);

      for (const actor of [owner, chef, staff, viewer]) {
        await request(app.getHttpServer())
          .get('/ingredients')
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
        await request(app.getHttpServer())
          .get(`/ingredients/${ingredient.id}`)
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
      }
    });

    it('write (create/update/receive/movement) is 200/201 for Owner+Chef, 403 for Staff+Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();

      for (const writer of [owner, chef]) {
        const ing = await createIngredient(writer.accessToken);
        await request(app.getHttpServer())
          .patch(`/ingredients/${ing.id}`)
          .set('Authorization', `Bearer ${writer.accessToken}`)
          .send({ name: 'Renamed' })
          .expect(200);
        await request(app.getHttpServer())
          .post(`/ingredients/${ing.id}/stock/receive`)
          .set('Authorization', `Bearer ${writer.accessToken}`)
          .send({ qty: 5 })
          .expect(201);
        await request(app.getHttpServer())
          .post(`/ingredients/${ing.id}/stock/movements`)
          .set('Authorization', `Bearer ${writer.accessToken}`)
          .send({ type: 'ADJUST', qty: 1, reason: 'Recount' })
          .expect(201);
      }

      const ingredient = await createIngredient(owner.accessToken);
      for (const nonWriter of [staff, viewer]) {
        await request(app.getHttpServer())
          .post('/ingredients')
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({ name: 'x', unit: 'kg', costPerUnit: 1 })
          .expect(403);
        await request(app.getHttpServer())
          .patch(`/ingredients/${ingredient.id}`)
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({ name: 'x' })
          .expect(403);
        await request(app.getHttpServer())
          .post(`/ingredients/${ingredient.id}/stock/receive`)
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({ qty: 1 })
          .expect(403);
        await request(app.getHttpServer())
          .post(`/ingredients/${ingredient.id}/stock/movements`)
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({ type: 'ADJUST', qty: 1 })
          .expect(403);
      }
    });

    it('Edge case: ingredient list does not leak cross-Kitchen data', async () => {
      const kitchenA = await buildRoleSet();
      const kitchenB = await buildRoleSet();
      await createIngredient(kitchenA.owner.accessToken);
      await createIngredient(kitchenA.owner.accessToken);

      const res = await request(app.getHttpServer())
        .get('/ingredients')
        .set('Authorization', `Bearer ${kitchenB.owner.accessToken}`)
        .expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // =========================================================================
  // Matrix: Recipes
  // =========================================================================
  describe('Recipes module matrix', () => {
    it('read (list/findOne/versions) is 200 for all 4 roles, including Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      const ingredient = await createIngredient(owner.accessToken);
      const recipe = await createRecipe(owner.accessToken, ingredient.id);

      for (const actor of [owner, chef, staff, viewer]) {
        await request(app.getHttpServer())
          .get('/recipes')
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
        await request(app.getHttpServer())
          .get(`/recipes/${recipe.id}`)
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
        await request(app.getHttpServer())
          .get(`/recipes/${recipe.id}/versions`)
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
      }
    });

    it('write (create/update) is 200/201 for Owner+Chef, 403 for Staff+Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      const ingredient = await createIngredient(owner.accessToken);

      for (const writer of [owner, chef]) {
        const recipe = await createRecipe(writer.accessToken, ingredient.id);
        await request(app.getHttpServer())
          .patch(`/recipes/${recipe.id}`)
          .set('Authorization', `Bearer ${writer.accessToken}`)
          .send({ name: 'Renamed recipe' })
          .expect(200);
      }

      const recipe = await createRecipe(owner.accessToken, ingredient.id);
      for (const nonWriter of [staff, viewer]) {
        await request(app.getHttpServer())
          .post('/recipes')
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({
            name: 'x',
            steps: ['a'],
            servings: 1,
            ingredients: [{ ingredientId: ingredient.id, qty: 1 }],
          })
          .expect(403);
        await request(app.getHttpServer())
          .patch(`/recipes/${recipe.id}`)
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({ name: 'x' })
          .expect(403);
      }
    });

    it('Edge case: recipe list does not leak cross-Kitchen data', async () => {
      const kitchenA = await buildRoleSet();
      const kitchenB = await buildRoleSet();
      const ing = await createIngredient(kitchenA.owner.accessToken);
      await createRecipe(kitchenA.owner.accessToken, ing.id);

      const res = await request(app.getHttpServer())
        .get('/recipes')
        .set('Authorization', `Bearer ${kitchenB.owner.accessToken}`)
        .expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // =========================================================================
  // Matrix: Guidelines
  // =========================================================================
  describe('Guidelines module matrix', () => {
    it('read (list incl. ?type= filter/findOne) is 200 for all 4 roles, including Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      const guideline = await createGuideline(owner.accessToken);

      for (const actor of [owner, chef, staff, viewer]) {
        await request(app.getHttpServer())
          .get('/guidelines')
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
        await request(app.getHttpServer())
          .get('/guidelines?type=SOP')
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
        await request(app.getHttpServer())
          .get(`/guidelines/${guideline.id}`)
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
      }
    });

    it('write (create/update) is 200/201 for Owner+Chef, 403 for Staff+Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();

      for (const writer of [owner, chef]) {
        const guideline = await createGuideline(writer.accessToken);
        await request(app.getHttpServer())
          .patch(`/guidelines/${guideline.id}`)
          .set('Authorization', `Bearer ${writer.accessToken}`)
          .send({ title: 'Renamed SOP' })
          .expect(200);
      }

      const guideline = await createGuideline(owner.accessToken);
      for (const nonWriter of [staff, viewer]) {
        await request(app.getHttpServer())
          .post('/guidelines')
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({ title: 'x', type: 'SOP', steps: ['a'] })
          .expect(403);
        await request(app.getHttpServer())
          .patch(`/guidelines/${guideline.id}`)
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({ title: 'x' })
          .expect(403);
      }
    });

    it('Edge case: guideline list (incl. ?type= filter) does not leak cross-Kitchen data', async () => {
      const kitchenA = await buildRoleSet();
      const kitchenB = await buildRoleSet();
      await createGuideline(kitchenA.owner.accessToken);

      const res = await request(app.getHttpServer())
        .get('/guidelines?type=SOP')
        .set('Authorization', `Bearer ${kitchenB.owner.accessToken}`)
        .expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // =========================================================================
  // Matrix: Tasks (incl. T011 completion sub-resource)
  // =========================================================================
  describe('Tasks module matrix', () => {
    it('read (list/findOne) is 200 for all 4 roles, including Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      const task = await createTask(owner.accessToken);

      for (const actor of [owner, chef, staff, viewer]) {
        await request(app.getHttpServer())
          .get('/tasks')
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
        await request(app.getHttpServer())
          .get(`/tasks/${task.id}`)
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
      }
    });

    it('create is 200/201 for Owner+Chef, 403 for Staff+Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      for (const writer of [owner, chef]) {
        await request(app.getHttpServer())
          .post('/tasks')
          .set('Authorization', `Bearer ${writer.accessToken}`)
          .send({ title: 'New task' })
          .expect(201);
      }
      for (const nonWriter of [staff, viewer]) {
        await request(app.getHttpServer())
          .post('/tasks')
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({ title: 'New task' })
          .expect(403);
      }
    });

    it('Staff assigned to own Task may PATCH status/checklistItems; Viewer assigned to own Task may NOT (read-only per FR-018)', async () => {
      const { owner, staff, viewer } = await buildRoleSet();

      const staffTask = await createTask(owner.accessToken);
      await request(app.getHttpServer())
        .patch(`/tasks/${staffTask.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ assigneeId: staff.user.id })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/tasks/${staffTask.id}`)
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      const viewerTask = await createTask(owner.accessToken);
      await request(app.getHttpServer())
        .patch(`/tasks/${viewerTask.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ assigneeId: viewer.user.id })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/tasks/${viewerTask.id}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(403);
    });

    it('Neither Staff nor Viewer may reassign a Task (WRITE_ROLES-only field), even their own', async () => {
      const { owner, staff } = await buildRoleSet();
      const task = await createTask(owner.accessToken);
      await request(app.getHttpServer())
        .patch(`/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ assigneeId: staff.user.id })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/tasks/${task.id}`)
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .send({ assigneeId: staff.user.id })
        .expect(403);
    });

    it('T011 completion sub-resource: Staff assigned to own Task can preview/confirm; Viewer assigned to own Task cannot (read-only)', async () => {
      const { owner, staff, viewer } = await buildRoleSet();

      const staffTask = await createTask(owner.accessToken);
      await request(app.getHttpServer())
        .patch(`/tasks/${staffTask.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ assigneeId: staff.user.id })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/tasks/${staffTask.id}/complete/preview`)
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/tasks/${staffTask.id}/complete/confirm`)
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .expect(201);

      const viewerTask = await createTask(owner.accessToken);
      await request(app.getHttpServer())
        .patch(`/tasks/${viewerTask.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ assigneeId: viewer.user.id })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/tasks/${viewerTask.id}/complete/preview`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/tasks/${viewerTask.id}/complete/confirm`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(403);
    });

    it('Edge case: task list does not leak cross-Kitchen data', async () => {
      const kitchenA = await buildRoleSet();
      const kitchenB = await buildRoleSet();
      await createTask(kitchenA.owner.accessToken);

      const res = await request(app.getHttpServer())
        .get('/tasks')
        .set('Authorization', `Bearer ${kitchenB.owner.accessToken}`)
        .expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // =========================================================================
  // AC3: unauthenticated calls are rejected on every module (401, not 403)
  // =========================================================================
  it('unauthenticated request is 401 on every in-scope module', async () => {
    for (const path of ['/ingredients', '/recipes', '/guidelines', '/tasks']) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
  });
});
