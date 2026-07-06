import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GenerateTaskController } from './generate-from-recipe/generate-task.controller';
import { GenerateTaskService } from './generate-from-recipe/generate-task.service';
import { TaskCompletionController } from './complete/task-completion.controller';
import { TaskCompletionService } from './complete/task-completion.service';

@Module({
  imports: [PrismaModule, AuthModule, InventoryModule, RealtimeModule],
  controllers: [
    TasksController,
    GenerateTaskController,
    TaskCompletionController,
  ],
  providers: [TasksService, GenerateTaskService, TaskCompletionService],
})
export class TasksModule {}
