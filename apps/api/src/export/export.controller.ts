import {
  Controller,
  Get,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ExportService } from './export.service';

const EXPORT_ROLES = [Role.OWNER, Role.ADMIN, Role.CHEF];

@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly prisma: PrismaService,
  ) {}

  // Mirrors the Inventory/Recipes controller pattern: access is always
  // scoped to the caller's own Kitchen, derived server-side, never
  // trusted from the URL.
  private async callerKitchenId(userId: string): Promise<string> {
    const caller = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!caller) {
      throw new UnauthorizedException('Caller no longer exists');
    }
    return caller.kitchenId;
  }

  @Get('ingredients')
  @Roles(...EXPORT_ROLES)
  async exportIngredients(
    @Req() req: { user: { sub: string } },
    @Res() res: Response,
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    const csv = await this.exportService.exportIngredientsCsv(kitchenId);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="ingredients.csv"',
    });
    res.send(csv);
  }

  @Get('recipes')
  @Roles(...EXPORT_ROLES)
  async exportRecipes(
    @Req() req: { user: { sub: string } },
    @Res() res: Response,
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    const csv = await this.exportService.exportRecipesCsv(kitchenId);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="recipes.csv"',
    });
    res.send(csv);
  }
}
