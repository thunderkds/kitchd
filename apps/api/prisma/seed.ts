/**
 * Demo data seed script (T022).
 *
 * Idempotent: re-running this script must not create duplicates or error.
 * We achieve idempotency by keying the top-level Organization on a fixed
 * name ("Demo Kitchen Co") and upserting Users by their unique email;
 * everything else (Kitchen, Recipes, Ingredients, Tasks, Notes,
 * Announcements) is looked up by a deterministic name/title before insert
 * and skipped if it already exists.
 *
 * Run with: npm --prefix apps/api run seed
 */
import {
  PrismaClient,
  Role,
  TaskStatus,
  GuidelineType,
  StockMovementType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ORG_NAME = 'Demo Kitchen Co';
const KITCHEN_NAME = 'Main Line';
const SEED_PASSWORD = 'Password123!';

async function main() {
  console.log('Seeding demo data...');

  // --- Organization + Kitchen (idempotent: find-or-create by name) ---
  let organization = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
  });
  if (!organization) {
    organization = await prisma.organization.create({
      data: { name: ORG_NAME },
    });
    console.log(`Created organization ${organization.id}`);
  } else {
    console.log(`Organization already exists: ${organization.id}`);
  }

  let kitchen = await prisma.kitchen.findFirst({
    where: { organizationId: organization.id, name: KITCHEN_NAME },
  });
  if (!kitchen) {
    kitchen = await prisma.kitchen.create({
      data: { name: KITCHEN_NAME, organizationId: organization.id },
    });
    console.log(`Created kitchen ${kitchen.id}`);
  } else {
    console.log(`Kitchen already exists: ${kitchen.id}`);
  }

  // --- Users, one per role (idempotent: upsert by unique email) ---
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const userSpecs: { email: string; role: Role }[] = [
    { email: 'owner@demo.kitchenos.dev', role: Role.OWNER },
    { email: 'chef@demo.kitchenos.dev', role: Role.CHEF },
    { email: 'staff@demo.kitchenos.dev', role: Role.STAFF },
    { email: 'viewer@demo.kitchenos.dev', role: Role.VIEWER },
  ];

  const users: Record<string, { id: string }> = {};
  for (const spec of userSpecs) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        email: spec.email,
        passwordHash,
        organizationId: organization.id,
        kitchenId: kitchen.id,
        role: spec.role,
      },
    });
    users[spec.role] = user;
    console.log(`User ${spec.email} (${spec.role}) -> ${user.id}`);
  }

  // --- Ingredients (idempotent: find-or-create by kitchenId+name) ---
  const ingredientSpecs = [
    { name: 'Flour', unit: 'kg', costPerUnit: 1.2, minThreshold: 5 },
    { name: 'Tomato', unit: 'kg', costPerUnit: 2.5, minThreshold: 3 },
    { name: 'Mozzarella', unit: 'kg', costPerUnit: 8.0, minThreshold: 2 },
    { name: 'Olive Oil', unit: 'L', costPerUnit: 6.5, minThreshold: 1 },
    { name: 'Basil', unit: 'bunch', costPerUnit: 1.0, minThreshold: 4 },
  ];

  const ingredients: Record<string, { id: string }> = {};
  for (const spec of ingredientSpecs) {
    let ingredient = await prisma.ingredient.findFirst({
      where: { kitchenId: kitchen.id, name: spec.name },
    });
    if (!ingredient) {
      ingredient = await prisma.ingredient.create({
        data: {
          kitchenId: kitchen.id,
          name: spec.name,
          unit: spec.unit,
          costPerUnit: spec.costPerUnit,
          minThreshold: spec.minThreshold,
        },
      });
      console.log(`Created ingredient ${spec.name} -> ${ingredient.id}`);
    }
    ingredients[spec.name] = ingredient;

    // Seed one stock batch per ingredient if none exist yet, deliberately
    // below min-threshold for one ingredient (Basil) to exercise the
    // low-stock dashboard flag (PRD criterion #4) out of the box.
    //
    // NOTE: InventoryService#currentStock is derived ONLY from the
    // StockMovement ledger (RECEIVE/ADJUST add, CONSUME/WASTE subtract) —
    // it deliberately never reads StockBatch.qty directly (see
    // apps/api/src/inventory/inventory.service.ts). So a StockBatch row
    // alone would NOT register as on-hand stock; we also write a matching
    // RECEIVE StockMovement so seeded quantities are visible via the
    // low-stock dashboard and task-completion-preview endpoints.
    const existingBatch = await prisma.stockBatch.findFirst({
      where: { ingredientId: ingredient.id },
    });
    if (!existingBatch) {
      const qty = spec.name === 'Basil' ? 1 : (spec.minThreshold ?? 1) * 4;
      const batch = await prisma.stockBatch.create({
        data: { ingredientId: ingredient.id, kitchenId: kitchen.id, qty },
      });
      await prisma.stockMovement.create({
        data: {
          ingredientId: ingredient.id,
          kitchenId: kitchen.id,
          batchId: batch.id,
          type: StockMovementType.RECEIVE,
          qty,
          reason: 'Initial seed stock',
          actorId: users[Role.OWNER].id,
        },
      });
      console.log(`  seeded stock batch + RECEIVE movement qty=${qty} for ${spec.name}`);
    }
  }

  // --- Recipes with ingredients (idempotent: find-or-create by name) ---
  let margherita = await prisma.recipe.findFirst({
    where: { kitchenId: kitchen.id, name: 'Margherita Pizza' },
  });
  if (!margherita) {
    margherita = await prisma.recipe.create({
      data: {
        kitchenId: kitchen.id,
        name: 'Margherita Pizza',
        steps: [
          'Prepare dough with flour',
          'Spread tomato sauce',
          'Add mozzarella and basil',
          'Bake at 250C for 10 minutes',
        ],
        servings: 4,
        ingredients: {
          create: [
            { ingredientId: ingredients['Flour'].id, qty: 0.5 },
            { ingredientId: ingredients['Tomato'].id, qty: 0.3 },
            { ingredientId: ingredients['Mozzarella'].id, qty: 0.4 },
            { ingredientId: ingredients['Basil'].id, qty: 0.1 },
          ],
        },
      },
    });
    console.log(`Created recipe Margherita Pizza -> ${margherita.id}`);
  }

  let bruschetta = await prisma.recipe.findFirst({
    where: { kitchenId: kitchen.id, name: 'Tomato Bruschetta' },
  });
  if (!bruschetta) {
    bruschetta = await prisma.recipe.create({
      data: {
        kitchenId: kitchen.id,
        name: 'Tomato Bruschetta',
        steps: [
          'Dice tomato and basil',
          'Toast bread',
          'Top bread with tomato mix and olive oil',
        ],
        servings: 6,
        ingredients: {
          create: [
            { ingredientId: ingredients['Tomato'].id, qty: 0.4 },
            { ingredientId: ingredients['Basil'].id, qty: 0.05 },
            { ingredientId: ingredients['Olive Oil'].id, qty: 0.05 },
          ],
        },
      },
    });
    console.log(`Created recipe Tomato Bruschetta -> ${bruschetta.id}`);
  }

  let caprese = await prisma.recipe.findFirst({
    where: { kitchenId: kitchen.id, name: 'Caprese Salad' },
  });
  if (!caprese) {
    caprese = await prisma.recipe.create({
      data: {
        kitchenId: kitchen.id,
        name: 'Caprese Salad',
        steps: ['Slice tomato and mozzarella', 'Layer with basil', 'Drizzle olive oil'],
        servings: 2,
        ingredients: {
          create: [
            { ingredientId: ingredients['Tomato'].id, qty: 0.2 },
            { ingredientId: ingredients['Mozzarella'].id, qty: 0.2 },
            { ingredientId: ingredients['Basil'].id, qty: 0.05 },
            { ingredientId: ingredients['Olive Oil'].id, qty: 0.02 },
          ],
        },
      },
    });
    console.log(`Created recipe Caprese Salad -> ${caprese.id}`);
  }

  // --- Tasks in varying states (idempotent: find-or-create by title) ---
  const taskSpecs: { title: string; status: TaskStatus; assigneeRole: Role }[] = [
    { title: 'Prep dough for lunch service', status: TaskStatus.TODO, assigneeRole: Role.STAFF },
    { title: 'Restock tomato sauce', status: TaskStatus.IN_PROGRESS, assigneeRole: Role.CHEF },
    { title: 'Close-out checklist', status: TaskStatus.DONE, assigneeRole: Role.STAFF },
  ];
  for (const spec of taskSpecs) {
    const existing = await prisma.task.findFirst({
      where: { kitchenId: kitchen.id, title: spec.title },
    });
    if (!existing) {
      const task = await prisma.task.create({
        data: {
          kitchenId: kitchen.id,
          title: spec.title,
          status: spec.status,
          assigneeId: users[spec.assigneeRole].id,
          checklistItems: [
            { id: 'c1', text: 'Step 1', done: spec.status === TaskStatus.DONE },
            { id: 'c2', text: 'Step 2', done: spec.status === TaskStatus.DONE },
          ],
        },
      });
      console.log(`Created task "${spec.title}" -> ${task.id}`);
    }
  }

  // --- Guideline (SOP) ---
  const existingGuideline = await prisma.guideline.findFirst({
    where: { kitchenId: kitchen.id, title: 'Opening Checklist' },
  });
  if (!existingGuideline) {
    const guideline = await prisma.guideline.create({
      data: {
        kitchenId: kitchen.id,
        title: 'Opening Checklist',
        type: GuidelineType.CHECKLIST,
        steps: ['Turn on ovens', 'Check walk-in temperature', 'Restock line'],
      },
    });
    console.log(`Created guideline Opening Checklist -> ${guideline.id}`);
  }

  // --- Notes (idempotent: find-or-create by title) ---
  const existingNote = await prisma.note.findFirst({
    where: { kitchenId: kitchen.id, title: 'Evening shift handoff' },
  });
  if (!existingNote) {
    const note = await prisma.note.create({
      data: {
        kitchenId: kitchen.id,
        authorId: users[Role.CHEF].id,
        title: 'Evening shift handoff',
        body: 'Ran low on basil tonight, reorder before tomorrow lunch service.',
        tags: ['handoff', 'inventory'],
        pinned: true,
      },
    });
    console.log(`Created note -> ${note.id}`);
  }

  // --- Announcement (Owner/Chef only per RBAC) ---
  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { kitchenId: kitchen.id, title: 'New POS rollout next week' },
  });
  if (!existingAnnouncement) {
    const announcement = await prisma.announcement.create({
      data: {
        kitchenId: kitchen.id,
        authorId: users[Role.OWNER].id,
        title: 'New POS rollout next week',
        body: 'We are switching to the new POS system starting Monday. Training session Friday 3pm.',
      },
    });
    console.log(`Created announcement -> ${announcement.id}`);
  }

  console.log('Seed complete.');
  console.log('Demo login credentials (all roles share the same password):');
  console.log(`  Password: ${SEED_PASSWORD}`);
  for (const spec of userSpecs) {
    console.log(`  ${spec.role}: ${spec.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
