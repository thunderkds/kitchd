import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Nightly job (T010): clones every recurring Task *template* (a Task with
// `recurrenceRule` set, e.g. "daily") into today's occurrence Task, so
// staff never have to re-create a daily prep list by hand.
//
// Idempotency: guarded by the DB unique constraint on
// (recurringTemplateId, occurrenceDate) — re-running for the same day
// upserts to a no-op instead of inserting a duplicate (AC2).
//
// Resilience: one template's failure is caught, logged with context, and
// does not stop the rest of the batch or crash the process (AC3).
const SUPPORTED_RULES = new Set(['daily']);

function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

@Injectable()
export class RecurrenceService {
  private readonly logger = new Logger(RecurrenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Entry point invoked by the scheduler (and directly by tests).
  async runNightlyGeneration(now: Date = new Date()): Promise<void> {
    const occurrenceDate = toDateOnly(now);

    const templates = await this.prisma.task.findMany({
      where: {
        recurrenceRule: { not: null },
        recurringTemplateId: null,
      },
    });

    for (const template of templates) {
      try {
        if (
          !template.recurrenceRule ||
          !SUPPORTED_RULES.has(template.recurrenceRule)
        ) {
          this.logger.warn(
            `Task ${template.id} has unsupported recurrenceRule "${template.recurrenceRule}" — skipping`,
          );
          continue;
        }

        await this.generateOccurrence(template, occurrenceDate);
      } catch (err) {
        this.logger.error(
          `Recurrence generation failed for template Task ${template.id} (kitchen ${template.kitchenId}, date ${occurrenceDate.toISOString()}): ${
            err instanceof Error ? err.message : String(err)
          }`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
  }

  private async generateOccurrence(
    template: Prisma.TaskGetPayload<Record<string, never>>,
    occurrenceDate: Date,
  ) {
    const dueAt = template.dueAt
      ? new Date(
          Date.UTC(
            occurrenceDate.getUTCFullYear(),
            occurrenceDate.getUTCMonth(),
            occurrenceDate.getUTCDate(),
            template.dueAt.getUTCHours(),
            template.dueAt.getUTCMinutes(),
          ),
        )
      : undefined;

    await this.prisma.task.upsert({
      where: {
        recurringTemplateId_occurrenceDate: {
          recurringTemplateId: template.id,
          occurrenceDate,
        },
      },
      update: {}, // already generated for this day — no-op (AC2)
      create: {
        kitchenId: template.kitchenId,
        title: template.title,
        assigneeId: template.assigneeId,
        dueAt,
        checklistItems: template.checklistItems as Prisma.InputJsonValue,
        recurringTemplateId: template.id,
        occurrenceDate,
      },
    });
  }
}
