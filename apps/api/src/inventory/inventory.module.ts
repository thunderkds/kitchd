import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { AlertsController } from './alerts/alerts.controller';
import { AlertsService } from './alerts/alerts.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [InventoryController, AlertsController],
  providers: [InventoryService, AlertsService],
  // Exported so the tasks module's T011 completion flow can reuse the
  // single StockMovement(CONSUME) write path instead of duplicating it.
  exports: [InventoryService],
})
export class InventoryModule {}
