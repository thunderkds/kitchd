import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KitchensService } from './kitchens.service';
import { RenameKitchenDto } from './dto/rename-kitchen.dto';

@Controller('kitchens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KitchensController {
  constructor(private readonly kitchensService: KitchensService) {}

  // Read access: any authenticated role, including Viewer — no @Roles
  // restriction, RolesGuard allows through when no roles are required.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.kitchensService.findById(id);
  }

  // Write access: Chef only, per the acceptance criteria for this guard.
  @Patch(':id')
  @Roles(Role.CHEF)
  rename(@Param('id') id: string, @Body() dto: RenameKitchenDto) {
    return this.kitchensService.rename(id, dto.name);
  }
}
