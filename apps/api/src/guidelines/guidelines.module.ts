import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GuidelinesController } from './guidelines.controller';
import { GuidelinesService } from './guidelines.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GuidelinesController],
  providers: [GuidelinesService],
})
export class GuidelinesModule {}
