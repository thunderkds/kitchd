import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { RecipeIngredientInputDto } from './dto/recipe-ingredient-input.dto';

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  // cost_computed is deliberately LIVE, not a historical snapshot: it is
  // always calculated from the CURRENT Ingredient.cost_per_unit at
  // read/save time. If ingredient prices change after a Recipe was
  // created, the next read reflects the new price. This is the chosen
  // MVP behavior (see PROJECT_SPEC known-risk note) — do not "fix" this
  // into a cached/frozen cost without a deliberate product decision.
  private async computeCost(
    tx: {
      ingredient: {
        findMany: (
          args: unknown,
        ) => Promise<
          { id: string; costPerUnit: number; name: string; unit: string }[]
        >;
      };
    },
    kitchenId: string,
    ingredients: RecipeIngredientInputDto[],
  ): Promise<{
    costComputed: number;
    resolved: {
      ingredientId: string;
      name: string;
      unit: string;
      qty: number;
      costPerUnit: number;
      lineCost: number;
    }[];
  }> {
    const ingredientIds = ingredients.map((i) => i.ingredientId);
    const found = await tx.ingredient.findMany({
      where: { id: { in: ingredientIds }, kitchenId },
    });
    const byId = new Map(found.map((f) => [f.id, f]));

    let costComputed = 0;
    const resolved = ingredients.map((line) => {
      const ingredient = byId.get(line.ingredientId);
      if (!ingredient) {
        // Ingredient not found (or belongs to another kitchen) — treated
        // as a validation error at write time, per the Edge Case
        // Checklist: a Recipe never references an ingredient that
        // doesn't (visibly, to this kitchen) exist.
        throw new BadRequestException(
          `Ingredient ${line.ingredientId} not found`,
        );
      }
      const lineCost = ingredient.costPerUnit * line.qty;
      costComputed += lineCost;
      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        qty: line.qty,
        costPerUnit: ingredient.costPerUnit,
        lineCost,
      };
    });

    return { costComputed, resolved };
  }

  private async serialize(recipeId: string, kitchenId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: true },
    });
    if (!recipe || recipe.kitchenId !== kitchenId) {
      throw new NotFoundException('Recipe not found');
    }

    // Live cost: recomputed here from current Ingredient prices, not
    // read from any stored column.
    const { costComputed, resolved } = await this.computeCost(
      this.prisma,
      kitchenId,
      recipe.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        qty: ri.qty,
      })),
    );

    return {
      id: recipe.id,
      kitchenId: recipe.kitchenId,
      name: recipe.name,
      steps: recipe.steps,
      servings: recipe.servings,
      version: recipe.version,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      ingredients: resolved,
      costComputed,
    };
  }

  async list(kitchenId: string) {
    const recipes = await this.prisma.recipe.findMany({ where: { kitchenId } });
    return Promise.all(recipes.map((r) => this.serialize(r.id, kitchenId)));
  }

  async findOne(id: string, kitchenId: string) {
    return this.serialize(id, kitchenId);
  }

  async create(kitchenId: string, dto: CreateRecipeDto) {
    const recipeId = await this.prisma.$transaction(async (tx) => {
      const { costComputed, resolved } = await this.computeCost(
        tx,
        kitchenId,
        dto.ingredients,
      );

      const recipe = await tx.recipe.create({
        data: {
          kitchenId,
          name: dto.name,
          steps: dto.steps,
          servings: dto.servings,
          version: 1,
          ingredients: {
            create: dto.ingredients.map((i) => ({
              ingredientId: i.ingredientId,
              qty: i.qty,
            })),
          },
        },
      });

      // First version snapshot, written atomically with the Recipe
      // itself so version 1 is always retrievable.
      await tx.recipeVersion.create({
        data: {
          recipeId: recipe.id,
          version: 1,
          name: dto.name,
          steps: dto.steps,
          servings: dto.servings,
          ingredientsSnapshot: resolved,
          costComputedAtSnapshot: costComputed,
        },
      });

      return recipe.id;
    });

    return this.serialize(recipeId, kitchenId);
  }

  // Editing a Recipe (name/steps/servings/ingredients) always increments
  // version and writes an append-only RecipeVersion snapshot — mirroring
  // the StockMovement ledger pattern. There is no route that mutates a
  // RecipeVersion row after it is written; prior version data remains
  // retrievable via GET /recipes/:id/versions.
  async update(id: string, kitchenId: string, dto: UpdateRecipeDto) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.recipe.findUnique({
        where: { id },
        include: { ingredients: true },
      });
      if (!existing || existing.kitchenId !== kitchenId) {
        throw new NotFoundException('Recipe not found');
      }

      const nextName = dto.name ?? existing.name;
      const nextSteps = dto.steps ?? existing.steps;
      const nextServings =
        dto.servings !== undefined ? dto.servings : existing.servings;
      const nextIngredients =
        dto.ingredients ??
        existing.ingredients.map((ri) => ({
          ingredientId: ri.ingredientId,
          qty: ri.qty,
        }));

      const { costComputed, resolved } = await this.computeCost(
        tx,
        kitchenId,
        nextIngredients,
      );

      const nextVersion = existing.version + 1;

      await tx.recipe.update({
        where: { id },
        data: {
          name: nextName,
          steps: nextSteps,
          servings: nextServings,
          version: nextVersion,
          ...(dto.ingredients
            ? {
                ingredients: {
                  deleteMany: {},
                  create: dto.ingredients.map((i) => ({
                    ingredientId: i.ingredientId,
                    qty: i.qty,
                  })),
                },
              }
            : {}),
        },
      });

      await tx.recipeVersion.create({
        data: {
          recipeId: id,
          version: nextVersion,
          name: nextName,
          steps: nextSteps,
          servings: nextServings,
          ingredientsSnapshot: resolved,
          costComputedAtSnapshot: costComputed,
        },
      });
    });

    return this.serialize(id, kitchenId);
  }

  async listVersions(id: string, kitchenId: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe || recipe.kitchenId !== kitchenId) {
      throw new NotFoundException('Recipe not found');
    }
    return this.prisma.recipeVersion.findMany({
      where: { recipeId: id },
      orderBy: { version: 'desc' },
    });
  }
}
