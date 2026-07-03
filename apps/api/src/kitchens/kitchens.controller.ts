import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { KitchensService } from './kitchens.service';
import { RenameKitchenDto } from './dto/rename-kitchen.dto';

@Controller('kitchens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KitchensController {
  constructor(
    private readonly kitchensService: KitchensService,
    private readonly prisma: PrismaService,
  ) {}

  // Mirrors the pattern in UsersService.invite: load the caller by
  // req.user.sub, then read their kitchenId — access is always scoped to
  // the caller's own Kitchen, never an arbitrary :id.
  private async callerKitchenId(userId: string): Promise<string> {
    const caller = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!caller) {
      throw new UnauthorizedException('Caller no longer exists');
    }
    return caller.kitchenId;
  }

  // Read access: any authenticated role, including Viewer — no @Roles
  // restriction, RolesGuard allows through when no roles are required.
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const callerKitchenId = await this.callerKitchenId(req.user.sub);
    return this.kitchensService.findById(id, callerKitchenId);
  }

  // Write access: Chef only, per the acceptance criteria for this guard.
  @Patch(':id')
  @Roles(Role.CHEF)
  async rename(
    @Param('id') id: string,
    @Body() dto: RenameKitchenDto,
    @Req() req: { user: { sub: string } },
  ) {
    const callerKitchenId = await this.callerKitchenId(req.user.sub);
    return this.kitchensService.rename(id, dto.name, callerKitchenId);
  }
}
