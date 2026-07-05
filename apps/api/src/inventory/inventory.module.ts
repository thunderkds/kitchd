import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  // Exported so the tasks module's T011 completion flow can reuse the
  // single StockMovement(CONSUME) write path instead of duplicating it.
  exports: [InventoryService],
})
export class InventoryModule {}
