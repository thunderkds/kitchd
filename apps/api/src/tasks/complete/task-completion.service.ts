import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../../inventory/inventory.service';
import { WRITE_ROLES } from '../tasks.service';

// T011 — Stock deduction on recipe-linked task completion (FR-008).
//
// Two-step confirm-before-deduct flow (see BRAINSTORMING_LOG.md /
// TASK_GUIDE_T011.md): `preview` computes the would-be deductions
// read-only; `confirm` actually writes the StockMovement(CONSUME) rows
// and flips the Task to DONE, atomically, inside a single transaction.
//
// RBAC NUANCE (FR-008 + FR-018): a WRITE_ROLES caller (OWNER/ADMIN/CHEF)
// may complete any Task in their Kitchen. A non-writer (STAFF/VIEWER)
// may only complete a Task assigned to themselves — completing it is a
// task-completion action they ARE permitted to perform, and the stock
// deduction is a side effect of that action, not a direct inventory
// edit. This intentionally bypasses the inventory WRITE_ROLES guard;
// see InventoryService#createConsumeMovementTx for the mirrored note.
@Injectable()
export class TaskCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  private async loadTask(
    taskId: string,
    kitchenId: string,
    caller: { id: string; role: Role },
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.kitchenId !== kitchenId) {
      throw new NotFoundException('Task not found');
    }
    const isWriter = WRITE_ROLES.includes(caller.role);
    if (!isWriter && task.assigneeId !== caller.id) {
      throw new ForbiddenException('Not your task');
    }
    return task;
  }

  // Computes deductQty = RecipeIngredient.qty (per serving) x
  // Recipe.servings (total servings the linked Task produces), per
  // ingredient. RecipeIngredient.qty is a per-serving amount; the task
  // represents making the full batch of `servings`, so the deduction
  // scales up accordingly (FR-008).
  private async computeDeductions(sourceRecipeId: string | null) {
    if (!sourceRecipeId) {
      return [];
    }
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: sourceRecipeId },
    });
    if (!recipe) {
      return [];
    }
    const servings = recipe.servings ?? 1;
    const recipeIngredients = await this.prisma.recipeIngredient.findMany({
      where: { recipeId: sourceRecipeId },
    });

    const deductions = [];
    for (const ri of recipeIngredients) {
      const deductQty = ri.qty * servings;
      const currentStock = await this.inventoryService.currentStock(
        ri.ingredientId,
      );
      const resultingStock = currentStock - deductQty;
      deductions.push({
        ingredientId: ri.ingredientId,
        deductQty,
        currentStock,
        resultingStock,
        wouldGoNegative: resultingStock < 0,
      });
    }
    return deductions;
  }

  async preview(
    taskId: string,
    kitchenId: string,
    caller: { id: string; role: Role },
  ) {
    const task = await this.loadTask(taskId, kitchenId, caller);
    const deductions = await this.computeDeductions(task.sourceRecipeId);
    return {
      requiresConfirmation: deductions.length > 0,
      deductions,
      hasNegativeWarning: deductions.some((d) => d.wouldGoNegative),
    };
  }

  async confirm(
    taskId: string,
    kitchenId: string,
    caller: { id: string; role: Role },
  ) {
    const task = await this.loadTask(taskId, kitchenId, caller);
    if (task.status === 'DONE') {
      throw new ConflictException('Task already completed');
    }
    const deductions = await this.computeDeductions(task.sourceRecipeId);

    return this.prisma.$transaction(async (tx) => {
      // Guard the double-completion race (two concurrent confirms for the
      // SAME task) atomically via a conditional UPDATE rather than a
      // separate read-then-write: `updateMany` with `status: { not: DONE }`
      // takes the row's write lock at UPDATE time and reports 0 rows
      // affected if another transaction already flipped it to DONE first,
      // regardless of the DB's default read-committed isolation level.
      const claim = await tx.task.updateMany({
        where: { id: taskId, kitchenId, status: { not: 'DONE' } },
        data: { status: 'DONE' },
      });
      if (claim.count === 0) {
        throw new ConflictException('Task already completed');
      }

      const movements = [];
      for (const d of deductions) {
        const movement = await this.inventoryService.createConsumeMovementTx(
          tx,
          {
            ingredientId: d.ingredientId,
            kitchenId,
            actorId: caller.id,
            qty: d.deductQty,
            reason: `Task ${taskId} completion`,
          },
        );
        movements.push(movement);
      }

      const updatedTask = await tx.task.findUnique({ where: { id: taskId } });

      return {
        task: updatedTask,
        movements,
        hasNegativeWarning: deductions.some((d) => d.wouldGoNegative),
      };
    });
  }
}
