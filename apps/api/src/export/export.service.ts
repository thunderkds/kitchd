import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportIngredientsCsv(kitchenId: string): Promise<string> {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { kitchenId },
      orderBy: { name: 'asc' },
    });

    const columns = [
      'id',
      'name',
      'unit',
      'costPerUnit',
      'category',
      'allergens',
      'supplierId',
      'minThreshold',
    ];

    const rows = ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      costPerUnit: i.costPerUnit,
      category: i.category ?? '',
      allergens: i.allergens.join(';'),
      supplierId: i.supplierId ?? '',
      minThreshold: i.minThreshold ?? '',
    }));

    // header: true still emits a header-only CSV when rows is empty.
    return stringify(rows, { header: true, columns });
  }

  async exportRecipesCsv(kitchenId: string): Promise<string> {
    const recipes = await this.prisma.recipe.findMany({
      where: { kitchenId },
      orderBy: { name: 'asc' },
      include: {
        ingredients: {
          include: { ingredient: true },
        },
      },
    });

    const columns = [
      'recipeId',
      'recipeName',
      'servings',
      'steps',
      'ingredientId',
      'ingredientName',
      'qty',
      'unit',
    ];

    // One CSV row per RecipeIngredient (the breakdown), with the parent
    // Recipe's fields repeated — the simplest flat shape that still
    // captures the full Recipe+RecipeIngredient relationship in one file.
    const rows: Record<string, string | number>[] = [];
    for (const recipe of recipes) {
      const steps = recipe.steps.join('\n');
      if (recipe.ingredients.length === 0) {
        rows.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          servings: recipe.servings ?? '',
          steps,
          ingredientId: '',
          ingredientName: '',
          qty: '',
          unit: '',
        });
        continue;
      }
      for (const line of recipe.ingredients) {
        rows.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          servings: recipe.servings ?? '',
          steps,
          ingredientId: line.ingredientId,
          ingredientName: line.ingredient.name,
          qty: line.qty,
          unit: line.ingredient.unit,
        });
      }
    }

    return stringify(rows, { header: true, columns });
  }
}
