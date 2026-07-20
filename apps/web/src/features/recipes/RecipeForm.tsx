import { useState } from 'react';
import type { Ingredient } from '../inventory/types';
import type { Recipe, RecipeInput } from './types';

interface IngredientRow {
  ingredientId: string;
  qty: string;
}

interface RecipeFormProps {
  mode: 'create' | 'edit';
  initial?: Recipe | null;
  ingredients: Ingredient[];
  onSubmit: (input: RecipeInput) => Promise<void>;
  onCancel: () => void;
}

function toSteps(stepsText: string): string[] {
  return stepsText
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function initialRows(recipe?: Recipe | null): IngredientRow[] {
  if (recipe && recipe.ingredients.length > 0) {
    return recipe.ingredients.map((i) => ({ ingredientId: i.ingredientId, qty: String(i.qty) }));
  }
  return [{ ingredientId: '', qty: '' }];
}

/**
 * Shared create/edit form for Recipes (T036). Mirrors the client-side
 * validation of CreateRecipeDto/UpdateRecipeDto on the backend:
 * `MinLength(1)` on name, `ArrayMinSize(1)` on ingredients — a submit that
 * fails either check makes no network call (Acceptance Criterion 7).
 */
export function RecipeForm({ mode, initial, ingredients, onSubmit, onCancel }: RecipeFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [servingsText, setServingsText] = useState(initial?.servings != null ? String(initial.servings) : '');
  const [stepsText, setStepsText] = useState(initial?.steps.join('\n') ?? '');
  const [rows, setRows] = useState<IngredientRow[]>(initialRows(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addRow = () => setRows((r) => [...r, { ingredientId: '', qty: '' }]);
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<IngredientRow>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);

    const trimmedName = name.trim();
    const validRows = rows.filter((r) => r.ingredientId && r.qty.trim().length > 0);

    if (trimmedName.length === 0) {
      setError('Name is required.');
      return;
    }
    if (validRows.length === 0) {
      setError('At least one ingredient is required.');
      return;
    }

    const input: RecipeInput = {
      name: trimmedName,
      steps: toSteps(stepsText),
      servings: servingsText.trim() ? Number(servingsText) : undefined,
      ingredients: validRows.map((r) => ({ ingredientId: r.ingredientId, qty: Number(r.qty) })),
    };

    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border rounded p-4 flex flex-col gap-3 max-w-xl">
      {error && (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          className="border rounded px-2 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Recipe name"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Servings
        <input
          type="number"
          min={0}
          className="border rounded px-2 py-2 text-sm"
          value={servingsText}
          onChange={(e) => setServingsText(e.target.value)}
          aria-label="Recipe servings"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Steps (one per line)
        <textarea
          className="border rounded px-2 py-2 text-sm min-h-32"
          value={stepsText}
          onChange={(e) => setStepsText(e.target.value)}
          aria-label="Recipe steps"
        />
      </label>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Ingredients</p>
        {ingredients.length === 0 ? (
          <p className="text-muted text-sm">No ingredients in Inventory yet — add one there first.</p>
        ) : (
          rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap" data-testid={`ingredient-row-${idx}`}>
              <select
                className="border rounded px-2 py-2 text-sm flex-1 min-w-40"
                value={row.ingredientId}
                onChange={(e) => updateRow(idx, { ingredientId: e.target.value })}
                aria-label={`Ingredient ${idx + 1}`}
              >
                <option value="">Select ingredient…</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="any"
                className="border rounded px-2 py-2 text-sm w-24"
                value={row.qty}
                onChange={(e) => updateRow(idx, { qty: e.target.value })}
                aria-label={`Quantity ${idx + 1}`}
              />
              <button
                type="button"
                className="text-sm px-2 py-1 border rounded"
                onClick={() => removeRow(idx)}
                disabled={rows.length === 1}
              >
                Remove
              </button>
            </div>
          ))
        )}
        <button type="button" className="self-start text-sm px-2 py-1 border rounded" onClick={addRow}>
          Add ingredient
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="self-start px-3 py-2 text-sm rounded bg-accent text-white disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {mode === 'edit' ? 'Save Changes' : 'Create Recipe'}
        </button>
        <button type="button" className="text-sm px-3 py-1 border rounded" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
