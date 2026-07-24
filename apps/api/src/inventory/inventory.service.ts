import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  // Current on-hand qty for an ingredient, derived by summing the
  // append-only StockMovement ledger. There is NO cached balance column
  // by design (see MEMORY append-only pattern) — deriving on read avoids
  // read-modify-write races. RECEIVE/ADJUST add, CONSUME/WASTE subtract.
  // Used by the T011 task-completion flow only to compute the
  // negative-stock WARNING; it never gates the deduction (FR-008 allows
  // stock to go negative — it is flagged, not blocked).
  async currentStock(ingredientId: string): Promise<number> {
    const movements = await this.prisma.stockMovement.findMany({
      where: { ingredientId },
      select: { type: true, qty: true },
    });
    return movements.reduce((sum, m) => {
      if (m.type === 'RECEIVE' || m.type === 'ADJUST') {
        return sum + m.qty;
      }
      return sum - m.qty; // CONSUME, WASTE
    }, 0);
  }

  // Transaction-aware CONSUME writer used by the T011 task-completion
  // stock-deduction flow. Kept here so InventoryService stays the single
  // owner of the StockMovement append-only write path — the tasks module
  // reuses this rather than duplicating the insert logic (see MEMORY).
  //
  // It accepts an interactive transaction client so a whole recipe's
  // multi-ingredient deduction commits atomically with the Task status
  // flip in TaskCompletionService.
  //
  // RBAC NUANCE (FR-008 + FR-018): this path is intentionally NOT behind
  // the inventory WRITE_ROLES guard. It is reachable by a STAFF user via
  // task completion because the deduction is a *side effect* of completing
  // their own assigned Task, not a direct inventory edit. Authorization is
  // enforced upstream in TaskCompletionService (own-task check) — never
  // trust this method to be called only by inventory writers.
  async createConsumeMovementTx(
    tx: Prisma.TransactionClient,
    params: {
      ingredientId: string;
      kitchenId: string;
      actorId: string;
      qty: number;
      reason?: string;
    },
  ) {
    return tx.stockMovement.create({
      data: {
        ingredientId: params.ingredientId,
        kitchenId: params.kitchenId,
        type: 'CONSUME',
        qty: params.qty,
        reason: params.reason,
        actorId: params.actorId,
      },
    });
  }
}
