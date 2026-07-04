import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GenerateTaskController } from './generate-from-recipe/generate-task.controller';
import { GenerateTaskService } from './generate-from-recipe/generate-task.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TasksController, GenerateTaskController],
  providers: [TasksService, GenerateTaskService],
})
export class TasksModule {}
