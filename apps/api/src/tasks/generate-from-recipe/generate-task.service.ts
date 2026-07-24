import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Snapshots a Recipe's or Guideline's `steps` array into a new Task's
// checklistItems at generation time. This is a one-time copy, not a
// live reference: subsequent edits/versioning of the source Recipe or
// Guideline must NOT retroactively change the generated Task's
// checklist (per the T009 Edge Case Checklist).
@Injectable()
export class GenerateTaskService {
  constructor(private readonly prisma: PrismaService) {}

  private snapshotChecklist(steps: string[]) {
    return steps.map((step) => ({
      id: crypto.randomUUID(),
      text: step,
      done: false,
    }));
  }

  async fromRecipe(recipeId: string, kitchenId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe || recipe.kitchenId !== kitchenId) {
      throw new NotFoundException('Recipe not found');
    }

    return this.prisma.task.create({
      data: {
        kitchenId,
        title: recipe.name,
        sourceRecipeId: recipe.id,
        checklistItems: this.snapshotChecklist(recipe.steps),
      },
    });
  }

  async fromGuideline(guidelineId: string, kitchenId: string) {
    const guideline = await this.prisma.guideline.findUnique({
      where: { id: guidelineId },
    });
    if (!guideline || guideline.kitchenId !== kitchenId) {
      throw new NotFoundException('Guideline not found');
    }

    return this.prisma.task.create({
      data: {
        kitchenId,
        title: guideline.title,
        sourceGuidelineId: guideline.id,
        checklistItems: this.snapshotChecklist(guideline.steps),
      },
    });
  }
}
