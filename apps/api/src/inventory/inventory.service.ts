import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listIngredients(kitchenId: string) {
    return this.prisma.ingredient.findMany({ where: { kitchenId } });
  }

  async findIngredient(id: string, kitchenId: string) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
    });
    // Scoped identically to the Kitchens pattern: a mismatched kitchen
    // behaves like a non-existent ingredient (404), never a 403.
    if (!ingredient || ingredient.kitchenId !== kitchenId) {
      throw new NotFoundException('Ingredient not found');
    }
    return ingredient;
  }

  async createIngredient(kitchenId: string, dto: CreateIngredientDto) {
    return this.prisma.ingredient.create({
      data: { ...dto, kitchenId, allergens: dto.allergens ?? [] },
    });
  }

  async updateIngredient(
    id: string,
    kitchenId: string,
    dto: UpdateIngredientDto,
  ) {
    await this.findIngredient(id, kitchenId);
    return this.prisma.ingredient.update({ where: { id }, data: dto });
  }

  // Receiving stock creates a StockBatch and its originating
  // StockMovement(type=RECEIVE) row atomically — either both are written
  // or neither is.
  async receiveStock(
    ingredientId: string,
    kitchenId: string,
    actorId: string,
    dto: ReceiveStockDto,
  ) {
    await this.findIngredient(ingredientId, kitchenId);

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.stockBatch.create({
        data: {
          ingredientId,
          kitchenId,
          qty: dto.qty,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          location: dto.location,
        },
      });
      const movement = await tx.stockMovement.create({
        data: {
          ingredientId,
          kitchenId,
          batchId: batch.id,
          type: 'RECEIVE',
          qty: dto.qty,
          actorId,
        },
      });
      return { batch, movement };
    });
  }

  // Append-only ledger entry for CONSUME/WASTE/ADJUST. No update/delete
  // endpoint exists for StockMovement by design.
  async createMovement(
    ingredientId: string,
    kitchenId: string,
    actorId: string,
    dto: CreateStockMovementDto,
  ) {
    await this.findIngredient(ingredientId, kitchenId);

    if (dto.batchId) {
      const batch = await this.prisma.stockBatch.findUnique({
        where: { id: dto.batchId },
      });
      if (!batch || batch.ingredientId !== ingredientId) {
        throw new BadRequestException(
          'batchId does not belong to this ingredient',
        );
      }
    }

    return this.prisma.stockMovement.create({
      data: {
        ingredientId,
        kitchenId,
        batchId: dto.batchId,
        type: dto.type,
        qty: dto.qty,
        reason: dto.reason,
        actorId,
      },
    });
  }

  async listMovements(ingredientId: string, kitchenId: string) {
    await this.findIngredient(ingredientId, kitchenId);
    return this.prisma.stockMovement.findMany({
      where: { ingredientId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
