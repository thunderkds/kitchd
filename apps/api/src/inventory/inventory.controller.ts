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
import { InventoryService } from './inventory.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

const WRITE_ROLES = [Role.OWNER, Role.ADMIN, Role.CHEF];

@Controller('ingredients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  // Mirrors the Kitchens/Users pattern: access is always scoped to the
  // caller's own Kitchen, derived server-side, never trusted from the URL.
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
    return this.inventoryService.listIngredients(kitchenId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.inventoryService.findIngredient(id, kitchenId);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @Body() dto: CreateIngredientDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.inventoryService.createIngredient(kitchenId, dto);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.inventoryService.updateIngredient(id, kitchenId, dto);
  }

  @Post(':id/stock/receive')
  @Roles(...WRITE_ROLES)
  async receiveStock(
    @Param('id') id: string,
    @Body() dto: ReceiveStockDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.inventoryService.receiveStock(id, kitchenId, req.user.sub, dto);
  }

  @Post(':id/stock/movements')
  @Roles(...WRITE_ROLES)
  async createMovement(
    @Param('id') id: string,
    @Body() dto: CreateStockMovementDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.inventoryService.createMovement(
      id,
      kitchenId,
      req.user.sub,
      dto,
    );
  }

  @Get(':id/stock/movements')
  async listMovements(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.inventoryService.listMovements(id, kitchenId);
  }
}
