import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { RecurrenceService } from './recurrence.service';

describe('Recurrence (T010, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let recurrenceService: RecurrenceService;

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
    recurrenceService = app.get(RecurrenceService);
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

  async function createRecurringTemplate(
    ownerToken: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Prep morning stock',
        checklistItems: [{ text: 'Chop veg' }, { text: 'Portion proteins' }],
        ...overrides,
      })
      .expect(201);

    // recurrenceRule isn't on CreateTaskDto (out of scope to expose via
    // API in this task) — set it directly at the data layer, matching how
    // a template would be marked recurring.
    return prisma.task.update({
      where: { id: res.body.id },
      data: { recurrenceRule: 'daily' },
    });
  }

  it('AC1: a daily-recurring template generates a new Task occurrence for today', async () => {
    const owner = await signupOwner();
    const template = await createRecurringTemplate(owner.accessToken);

    await recurrenceService.runNightlyGeneration(
      new Date('2026-07-06T00:05:00Z'),
    );

    const occurrences = await prisma.task.findMany({
      where: { recurringTemplateId: template.id },
    });

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].title).toBe(template.title);
    expect(occurrences[0].checklistItems).toEqual(template.checklistItems);
    expect(occurrences[0].kitchenId).toBe(template.kitchenId);
    expect(occurrences[0].occurrenceDate?.toISOString()).toBe(
      '2026-07-06T00:00:00.000Z',
    );
  });

  it('AC2: running the job twice for the same day does not duplicate the occurrence', async () => {
    const owner = await signupOwner();
    const template = await createRecurringTemplate(owner.accessToken);

    await recurrenceService.runNightlyGeneration(
      new Date('2026-07-06T00:05:00Z'),
    );
    await recurrenceService.runNightlyGeneration(
      new Date('2026-07-06T23:00:00Z'),
    );

    const occurrences = await prisma.task.findMany({
      where: { recurringTemplateId: template.id },
    });

    expect(occurrences).toHaveLength(1);
  });

  it('AC2b: running the job on a different day generates a second, distinct occurrence', async () => {
    const owner = await signupOwner();
    const template = await createRecurringTemplate(owner.accessToken);

    await recurrenceService.runNightlyGeneration(
      new Date('2026-07-06T00:05:00Z'),
    );
    await recurrenceService.runNightlyGeneration(
      new Date('2026-07-07T00:05:00Z'),
    );

    const occurrences = await prisma.task.findMany({
      where: { recurringTemplateId: template.id },
      orderBy: { occurrenceDate: 'asc' },
    });

    expect(occurrences).toHaveLength(2);
  });

  it('AC3: a failure generating one template is logged and does not crash the job or block other templates', async () => {
    const owner = await signupOwner();
    const goodTemplate = await createRecurringTemplate(owner.accessToken, {
      title: 'Good template',
    });
    const badTemplate = await createRecurringTemplate(owner.accessToken, {
      title: 'Bad template',
    });

    const loggerErrorSpy = jest
      .spyOn(
        (
          recurrenceService as unknown as {
            logger: { error: (...args: unknown[]) => void };
          }
        ).logger,
        'error',
      )
      .mockImplementation(() => undefined);

    const createSpy = jest
      .spyOn(prisma.task, 'upsert')
      .mockImplementationOnce(() => {
        throw new Error('forced failure for AC3');
      });

    await expect(
      recurrenceService.runNightlyGeneration(new Date('2026-07-08T00:05:00Z')),
    ).resolves.toBeUndefined();

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy.mock.calls[0][0]).toContain('forced failure for AC3');

    createSpy.mockRestore();
    loggerErrorSpy.mockRestore();

    const occurrences = await prisma.task.findMany({
      where: {
        recurringTemplateId: { in: [goodTemplate.id, badTemplate.id] },
      },
    });
    // Whichever template ran second (not intercepted by the one-time
    // mock) should still have succeeded — the failure must not abort the
    // whole batch.
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
  });

  it('Edge case: deleting a template after occurrences were generated leaves the generated Task unaffected (FK is onDelete: SetNull, not Cascade)', async () => {
    const owner = await signupOwner();
    const template = await createRecurringTemplate(owner.accessToken);

    await recurrenceService.runNightlyGeneration(
      new Date('2026-07-06T00:05:00Z'),
    );
    const occurrence = await prisma.task.findFirstOrThrow({
      where: { recurringTemplateId: template.id },
    });

    // Delete the template directly at the data layer (no DELETE /tasks/:id
    // endpoint exists yet, so this simulates a future/manual delete path).
    // The FK's onDelete: SetNull means this must NOT cascade-delete the
    // generated occurrence — only null out its back-reference.
    await prisma.task.delete({ where: { id: template.id } });

    const stillThere = await prisma.task.findUnique({
      where: { id: occurrence.id },
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.recurringTemplateId).toBeNull();
  });
});
