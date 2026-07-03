import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { KitchensController } from './kitchens.controller';
import { KitchensService } from './kitchens.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [KitchensController],
  providers: [KitchensService],
})
export class KitchensModule {}
