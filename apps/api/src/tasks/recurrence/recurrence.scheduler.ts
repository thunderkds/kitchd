import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RecurrenceService } from './recurrence.service';

// Fires `RecurrenceService.runNightlyGeneration()` once per hour and lets
// the service itself no-op on hours other than midnight-UTC, which keeps
// this scheduler dependency-free (no @nestjs/schedule needed for a single
// nightly job) while still tolerating a missed/late process restart.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class RecurrenceScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecurrenceScheduler.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly recurrenceService: RecurrenceService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      if (new Date().getUTCHours() === 0) {
        this.recurrenceService.runNightlyGeneration().catch((err) => {
          this.logger.error(
            `Nightly recurrence job crashed unexpectedly: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
      }
    }, CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
