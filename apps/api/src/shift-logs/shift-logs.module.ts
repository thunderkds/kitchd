import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ShiftLogsController } from './shift-logs.controller';
import { ShiftLogsService } from './shift-logs.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ShiftLogsController],
  providers: [ShiftLogsService],
})
export class ShiftLogsModule {}
