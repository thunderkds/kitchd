// Matches RecipesService#serialize's response shape exactly (read directly
// from apps/api/src/recipes/recipes.service.ts — not guessed). Unit/cost
// come from the linked Ingredient, resolved server-side; they are not
// stored per Recipe line.
export interface RecipeIngredientResolved {
  ingredientId: string;
  name: string;
  unit: string;
  qty: number;
  costPerUnit: number;
  lineCost: number;
}

export interface Recipe {
  id: string;
  kitchenId: string;
  name: string;
  steps: string[];
  servings: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredientResolved[];
  costComputed: number;
}

// Input shape for POST/PATCH /recipes — mirrors CreateRecipeDto /
// UpdateRecipeDto (name, steps, servings, ingredients[{ingredientId, qty}]).
// Only schema-backed fields; see TASK_GUIDE_T036 Out of Scope for the
// FR-001 fields (category/photo/allergens/prep-time) deliberately omitted.
export interface RecipeIngredientInput {
  ingredientId: string;
  qty: number;
}

export interface RecipeInput {
  name: string;
  steps: string[];
  servings?: number | null;
  ingredients: RecipeIngredientInput[];
}
