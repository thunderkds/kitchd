import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory.service';
import { NotificationsService } from '../../notifications/notifications.service';

export const DEFAULT_EXPIRING_SOON_DAYS = 3;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Low-stock = Ingredient.currentStock below its own min_threshold.
  // min_threshold = 0 or null is treated as "no threshold configured" and
  // never flags (a 0-qty ingredient would otherwise always appear).
  // Reuses InventoryService#currentStock (single owner of the
  // append-only-ledger summation, see MEMORY) rather than re-deriving it.
  //
  // T016: this read also detects+persists the above->below threshold
  // TRANSITION on Ingredient.wasLowStock and fires exactly one
  // Notification per crossing (AC3) — never on every poll/read once
  // already flagged. Recipients are every member of the Kitchen (no
  // per-ingredient assignee concept exists in this schema).
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

    const lowStockIngredients = withStock.filter(
      (ingredient) =>
        ingredient.currentStock < (ingredient.minThreshold as number),
    );

    await this.syncLowStockState(kitchenId, withStock, lowStockIngredients);

    return lowStockIngredients;
  }

  // Diffs the freshly-computed low-stock set against each Ingredient's
  // persisted wasLowStock flag. Only a false->true flip notifies; a
  // still-low or still-ok ingredient is a no-op write (or no write).
  private async syncLowStockState(
    kitchenId: string,
    allIngredients: Array<{ id: string; name: string; wasLowStock: boolean }>,
    lowStockIngredients: Array<{ id: string; name: string }>,
  ) {
    const lowStockIds = new Set(lowStockIngredients.map((i) => i.id));

    const newlyLow = allIngredients.filter(
      (ingredient) => lowStockIds.has(ingredient.id) && !ingredient.wasLowStock,
    );
    const recovered = allIngredients.filter(
      (ingredient) => !lowStockIds.has(ingredient.id) && ingredient.wasLowStock,
    );

    for (const ingredient of newlyLow) {
      await this.prisma.ingredient.update({
        where: { id: ingredient.id },
        data: { wasLowStock: true },
      });
      const members = await this.prisma.user.findMany({
        where: { kitchenId },
        select: { id: true },
      });
      await this.notificationsService.notifyLowStock(
        kitchenId,
        members.map((m) => m.id),
        ingredient.name,
      );
    }

    for (const ingredient of recovered) {
      await this.prisma.ingredient.update({
        where: { id: ingredient.id },
        data: { wasLowStock: false },
      });
    }
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
