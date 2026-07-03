import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

const WRITE_ROLES = [Role.OWNER, Role.ADMIN, Role.CHEF];

@Controller('recipes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly prisma: PrismaService,
  ) {}

  // Same kitchen-scoped-controller pattern as InventoryController: derive
  // the caller's own kitchenId server-side, never trust a client-supplied
  // scope.
  private async callerKitchenId(userId: string): Promise<string> {
    const caller = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!caller) {
      throw new UnauthorizedException('Caller no longer exists');
    }
    return caller.kitchenId;
  }

  @Get()
  async list(@Req() req: { user: { sub: string } }) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.recipesService.list(kitchenId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.recipesService.findOne(id, kitchenId);
  }

  @Get(':id/versions')
  async listVersions(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.recipesService.listVersions(id, kitchenId);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @Body() dto: CreateRecipeDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.recipesService.create(kitchenId, dto);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRecipeDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.recipesService.update(id, kitchenId, dto);
  }
}
