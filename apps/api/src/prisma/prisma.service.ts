import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Retries the initial DB connection with backoff so the API doesn't crash
   * if Postgres isn't ready yet (e.g. docker compose still starting up).
   */
  private async connectWithRetry(retries = 10, delayMs = 1000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        if (attempt === retries) {
          this.logger.error(
            `Failed to connect to database after ${retries} attempts`,
          );
          throw err;
        }
        this.logger.warn(
          `Database not ready (attempt ${attempt}/${retries}), retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
