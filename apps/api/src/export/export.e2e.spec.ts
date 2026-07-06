import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { parse } from 'csv-parse/sync';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Export (e2e)', () => {
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
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/ingredients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Flour', unit: 'kg', costPerUnit: 1.5, ...overrides })
      .expect(201);
    return res.body as { id: string; name: string };
  }

  // AC1: Exported Ingredient CSV round-trips all fields with correct headers
  it('AC1: exports the Ingredient list as CSV with correct headers and values', async () => {
    const owner = await signupOwner();
    await createIngredient(owner.accessToken, {
      name: 'Sugar',
      unit: 'kg',
      costPerUnit: 2.25,
      category: 'baking',
      allergens: ['gluten'],
      minThreshold: 5,
    });

    const res = await request(app.getHttpServer())
      .get('/export/ingredients')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');

    const records = parse(res.text, { columns: true }) as Record<
      string,
      string
    >[];
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Sugar');
    expect(records[0].unit).toBe('kg');
    expect(records[0].costPerUnit).toBe('2.25');
    expect(records[0].category).toBe('baking');
    expect(records[0].allergens).toBe('gluten');
    expect(records[0].minThreshold).toBe('5');
  });

  // AC3: Exporting an empty Ingredient list produces a valid header-only CSV
  it('AC3: exporting an empty Ingredient list returns 200 with header-only CSV', async () => {
    const owner = await signupOwner();

    const res = await request(app.getHttpServer())
      .get('/export/ingredients')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const records = parse(res.text, { columns: true }) as Record<
      string,
      string
    >[];
    expect(records).toHaveLength(0);
    expect(res.text.trim().split('\n')).toHaveLength(1); // header row only
    expect(res.text).toContain('name');
  });

  // AC2: Recipe with commas/newlines in steps exports as valid, escaped CSV
  it('AC2: escapes commas and newlines in Recipe steps and round-trips correctly', async () => {
    const owner = await signupOwner();
    const flour = await createIngredient(owner.accessToken, { name: 'Flour' });

    await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Tricky Cake',
        steps: ['Mix flour, sugar, and butter', 'Bake at 350\nfor 45 min'],
        servings: 4,
        ingredients: [{ ingredientId: flour.id, qty: 2 }],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/export/recipes')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');

    const records = parse(res.text, { columns: true }) as Record<
      string,
      string
    >[];
    expect(records).toHaveLength(1);
    expect(records[0].recipeName).toBe('Tricky Cake');
    expect(records[0].steps).toBe(
      'Mix flour, sugar, and butter\nBake at 350\nfor 45 min',
    );
    expect(records[0].ingredientName).toBe('Flour');
    expect(records[0].qty).toBe('2');
  });

  it('Staff (read-only role) gets 403 attempting to export', async () => {
    const owner = await signupOwner();
    const staff = await inviteAndAccept(owner.accessToken, 'STAFF');

    await request(app.getHttpServer())
      .get('/export/ingredients')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(403);
  });

  it('Export is kitchen-scoped: another kitchen Ingredients never appear', async () => {
    const ownerA = await signupOwner();
    await createIngredient(ownerA.accessToken, { name: 'Kitchen A Salt' });

    const ownerB = await signupOwner();
    await createIngredient(ownerB.accessToken, { name: 'Kitchen B Pepper' });

    const res = await request(app.getHttpServer())
      .get('/export/ingredients')
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(200);

    const records = parse(res.text, { columns: true }) as Record<
      string,
      string
    >[];
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Kitchen B Pepper');
  });
});
