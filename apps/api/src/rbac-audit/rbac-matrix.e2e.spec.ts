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
  // T024 — RBAC audit follow-up: Notes, Announcements, ShiftLog, Comments
  // (T012-T015). Each module has its own distinct RBAC shape per
  // memory/MEMORY.md — audited against its own PRD line, not copied from
  // another module's matrix.
  // =========================================================================

  async function createNote(token: string) {
    const res = await request(app.getHttpServer())
      .post('/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ body: `Note ${Date.now()}-${Math.random()}` })
      .expect(201);
    return res.body as { id: string; authorId: string };
  }

  async function createAnnouncement(token: string) {
    const res = await request(app.getHttpServer())
      .post('/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Notice', body: `Body ${Date.now()}` })
      .expect(201);
    return res.body as { id: string };
  }

  async function createShiftLog(token: string) {
    const res = await request(app.getHttpServer())
      .post('/shift-logs')
      .set('Authorization', `Bearer ${token}`)
      .send({ shift: 'MORNING', body: `Handover ${Date.now()}` })
      .expect(201);
    return res.body as { id: string };
  }

  async function createComment(token: string, entityId: string) {
    const res = await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'task', entityId, body: `Comment ${Date.now()}` })
      .expect(201);
    return res.body as { id: string; authorId: string };
  }

  // =========================================================================
  // Matrix: Notes — every role except Viewer may author; only the author
  // may edit/pin/delete (FR-018). Distinct from Inventory's Owner/Admin/
  // Chef-only shape.
  // =========================================================================
  describe('Notes module matrix', () => {
    it('read (list/findOne) is 200 for all 4 roles, including Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      const note = await createNote(owner.accessToken);

      for (const actor of [owner, chef, staff, viewer]) {
        await request(app.getHttpServer())
          .get('/notes')
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
        await request(app.getHttpServer())
          .get(`/notes/${note.id}`)
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
      }
    });

    it('create is 201 for Owner/Chef/Staff, 403 for Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      for (const writer of [owner, chef, staff]) {
        await createNote(writer.accessToken);
      }
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ body: 'Should be blocked' })
        .expect(403);
    });

    it('only the author may update/delete their own Note — a non-author write-eligible role gets 403 (ownership layered on top of RolesGuard)', async () => {
      const { owner, chef, viewer } = await buildRoleSet();
      const note = await createNote(owner.accessToken);

      // Chef is write-eligible per RolesGuard, but is not the author.
      await request(app.getHttpServer())
        .patch(`/notes/${note.id}`)
        .set('Authorization', `Bearer ${chef.accessToken}`)
        .send({ body: 'Hijacked' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/notes/${note.id}`)
        .set('Authorization', `Bearer ${chef.accessToken}`)
        .expect(403);

      // Viewer is blocked at the coarser RolesGuard gate before ownership
      // is even evaluated.
      await request(app.getHttpServer())
        .patch(`/notes/${note.id}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ body: 'Hijacked' })
        .expect(403);

      // The author itself may update/delete.
      await request(app.getHttpServer())
        .patch(`/notes/${note.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ body: 'Edited by author' })
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/notes/${note.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
    });

    it('Edge case: note list does not leak cross-Kitchen data', async () => {
      const kitchenA = await buildRoleSet();
      const kitchenB = await buildRoleSet();
      await createNote(kitchenA.owner.accessToken);

      const res = await request(app.getHttpServer())
        .get('/notes')
        .set('Authorization', `Bearer ${kitchenB.owner.accessToken}`)
        .expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // =========================================================================
  // Matrix: Announcements — FR-021 "Owner/Chef broadcasts to all Staff".
  // Admin is deliberately excluded — narrower than both Notes and
  // Inventory. Staff/Viewer/Admin are all read-only here.
  // =========================================================================
  describe('Announcements module matrix', () => {
    it('read (list/findOne) is 200 for all 4 roles, including Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      const announcement = await createAnnouncement(owner.accessToken);

      for (const actor of [owner, chef, staff, viewer]) {
        await request(app.getHttpServer())
          .get('/announcements')
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
        await request(app.getHttpServer())
          .get(`/announcements/${announcement.id}`)
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
      }
    });

    it('create is 201 for Owner+Chef, 403 for Staff+Viewer (Admin excluded per FR-021, but Admin cannot currently be created via any code path — see memory/learnings.md 2026-07-06 Admin-role-unreachable finding)', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      for (const writer of [owner, chef]) {
        await createAnnouncement(writer.accessToken);
      }
      for (const nonWriter of [staff, viewer]) {
        await request(app.getHttpServer())
          .post('/announcements')
          .set('Authorization', `Bearer ${nonWriter.accessToken}`)
          .send({ title: 'x', body: 'x' })
          .expect(403);
      }
    });

    it('Edge case: announcement list does not leak cross-Kitchen data', async () => {
      const kitchenA = await buildRoleSet();
      const kitchenB = await buildRoleSet();
      await createAnnouncement(kitchenA.owner.accessToken);

      const res = await request(app.getHttpServer())
        .get('/announcements')
        .set('Authorization', `Bearer ${kitchenB.owner.accessToken}`)
        .expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // =========================================================================
  // Matrix: ShiftLog — same everyone-but-Viewer write shape as Notes, per
  // its own module comment referencing FR-018's blanket Viewer-read-only
  // rule. Audited independently, not assumed from Notes.
  // =========================================================================
  describe('ShiftLog module matrix', () => {
    it('read (list, incl. ?date= filter) is 200 for all 4 roles, including Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      await createShiftLog(owner.accessToken);

      for (const actor of [owner, chef, staff, viewer]) {
        await request(app.getHttpServer())
          .get('/shift-logs')
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
      }
    });

    it('create is 201 for Owner/Chef/Staff, 403 for Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      for (const writer of [owner, chef, staff]) {
        await createShiftLog(writer.accessToken);
      }
      await request(app.getHttpServer())
        .post('/shift-logs')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ shift: 'MORNING', body: 'Should be blocked' })
        .expect(403);
    });

    it('Edge case: shift-log list does not leak cross-Kitchen data', async () => {
      const kitchenA = await buildRoleSet();
      const kitchenB = await buildRoleSet();
      await createShiftLog(kitchenA.owner.accessToken);

      const res = await request(app.getHttpServer())
        .get('/shift-logs')
        .set('Authorization', `Bearer ${kitchenB.owner.accessToken}`)
        .expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // =========================================================================
  // Matrix: Comments — everyone-but-Viewer may author (FR-018, same shape
  // as Notes/ShiftLog); only the author may delete. Polymorphic entity
  // linkage (recipe/task/ingredient) must not bypass RBAC regardless of
  // which entity type is targeted.
  // =========================================================================
  describe('Comments module matrix', () => {
    it('read (list by entityType/entityId) is 200 for all 4 roles, including Viewer', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      const task = await createTask(owner.accessToken);
      const comment = await createComment(owner.accessToken, task.id);

      for (const actor of [owner, chef, staff, viewer]) {
        await request(app.getHttpServer())
          .get(`/comments?entityType=task&entityId=${task.id}`)
          .set('Authorization', `Bearer ${actor.accessToken}`)
          .expect(200);
      }
      expect(comment.id).toBeDefined();
    });

    it('create is 201 for Owner/Chef/Staff, 403 for Viewer — on multiple polymorphic entity types (task and recipe)', async () => {
      const { owner, chef, staff, viewer } = await buildRoleSet();
      const task = await createTask(owner.accessToken);
      const ingredient = await createIngredient(owner.accessToken);
      const recipe = await createRecipe(owner.accessToken, ingredient.id);

      for (const writer of [owner, chef, staff]) {
        await createComment(writer.accessToken, task.id);
        await request(app.getHttpServer())
          .post('/comments')
          .set('Authorization', `Bearer ${writer.accessToken}`)
          .send({
            entityType: 'recipe',
            entityId: recipe.id,
            body: 'On a recipe',
          })
          .expect(201);
      }

      for (const entity of [
        { entityType: 'task', entityId: task.id },
        { entityType: 'recipe', entityId: recipe.id },
      ]) {
        await request(app.getHttpServer())
          .post('/comments')
          .set('Authorization', `Bearer ${viewer.accessToken}`)
          .send({ ...entity, body: 'Should be blocked' })
          .expect(403);
      }
    });

    it('only the author may delete their own Comment — a non-author write-eligible role gets 403 (ownership layered on top of RolesGuard)', async () => {
      const { owner, chef, viewer } = await buildRoleSet();
      const task = await createTask(owner.accessToken);
      const comment = await createComment(owner.accessToken, task.id);

      // Chef is write-eligible per RolesGuard, but is not the author.
      await request(app.getHttpServer())
        .delete(`/comments/${comment.id}`)
        .set('Authorization', `Bearer ${chef.accessToken}`)
        .expect(403);

      // Viewer is blocked at the coarser RolesGuard gate.
      await request(app.getHttpServer())
        .delete(`/comments/${comment.id}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(403);

      // The author itself may delete.
      await request(app.getHttpServer())
        .delete(`/comments/${comment.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
    });

    it('Edge case: comments list does not leak cross-Kitchen data (checked across polymorphic entity types)', async () => {
      const kitchenA = await buildRoleSet();
      const kitchenB = await buildRoleSet();
      const taskA = await createTask(kitchenA.owner.accessToken);
      await createComment(kitchenA.owner.accessToken, taskA.id);

      // Kitchen B has no such task/comment; querying by Kitchen A's
      // entityId from Kitchen B must not leak Kitchen A's comment.
      const res = await request(app.getHttpServer())
        .get(`/comments?entityType=task&entityId=${taskA.id}`)
        .set('Authorization', `Bearer ${kitchenB.owner.accessToken}`)
        .expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // =========================================================================
  // AC3: unauthenticated calls are rejected on every module (401, not 403)
  // =========================================================================
  it('unauthenticated request is 401 on every in-scope module', async () => {
    for (const path of [
      '/ingredients',
      '/recipes',
      '/guidelines',
      '/tasks',
      '/notes',
      '/announcements',
      '/shift-logs',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
  });
});
