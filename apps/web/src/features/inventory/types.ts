export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  category?: string | null;
  allergens: string[];
  supplierId?: string | null;
  minThreshold?: number | null;
}

export type StockMovementType = 'RECEIVE' | 'CONSUME' | 'WASTE' | 'ADJUST';

export interface StockMovement {
  id: string;
  ingredientId: string;
  batchId?: string | null;
  type: StockMovementType;
  qty: number;
  reason?: string | null;
  actorId: string;
  createdAt: string;
}

export interface CreateIngredientInput {
  name: string;
  unit: string;
  costPerUnit: number;
  category?: string;
  minThreshold?: number;
}

export interface UpdateIngredientInput {
  name?: string;
  unit?: string;
  costPerUnit?: number;
  category?: string;
  minThreshold?: number;
}

export interface ReceiveStockInput {
  qty: number;
  expiryDate?: string;
  location?: string;
}
