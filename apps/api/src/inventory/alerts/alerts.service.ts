import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory.service';

export const DEFAULT_EXPIRING_SOON_DAYS = 3;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  // Low-stock = Ingredient.currentStock below its own min_threshold.
  // min_threshold = 0 or null is treated as "no threshold configured" and
  // never flags (a 0-qty ingredient would otherwise always appear).
  // Reuses InventoryService#currentStock (single owner of the
  // append-only-ledger summation, see MEMORY) rather than re-deriving it.
  async lowStock(kitchenId: string) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { kitchenId, minThreshold: { not: null, gt: 0 } },
    });

    const withStock = await Promise.all(
      ingredients.map(async (ingredient) => ({
        ...ingredient,
        currentStock: await this.inventoryService.currentStock(ingredient.id),
      })),
    );

    return withStock.filter(
      (ingredient) =>
        ingredient.currentStock < (ingredient.minThreshold as number),
    );
  }

  // StockBatches expiring within `days` days (default 3). Batches with a
  // null expiry_date are excluded — they never expire, so they can't be
  // "expiring soon".
  async expiringSoon(
    kitchenId: string,
    days: number = DEFAULT_EXPIRING_SOON_DAYS,
  ) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return this.prisma.stockBatch.findMany({
      where: {
        kitchenId,
        expiryDate: { not: null, lte: cutoff },
      },
      include: { ingredient: true },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
