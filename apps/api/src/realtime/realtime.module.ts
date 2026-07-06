import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';

// Exported so TasksModule/CommentsModule/AnnouncementsModule can inject
// RealtimeGateway as an additive emit-hook, same shape as the T016
// NotificationsService hook into CommentsService.
@Module({
  imports: [PrismaModule, AuthModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
