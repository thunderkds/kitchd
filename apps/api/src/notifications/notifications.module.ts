import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Exported so CommentsModule (mention hook) and InventoryModule
  // (low-stock transition hook) can reuse the single Notification write
  // path instead of duplicating it.
  exports: [NotificationsService],
})
export class NotificationsModule {}
