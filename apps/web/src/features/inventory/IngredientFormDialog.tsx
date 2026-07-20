import { useState } from 'react';
import { Dialog } from '../../components/Dialog/Dialog';
import { createIngredient, updateIngredient } from './api';
import type { Ingredient } from './types';

/**
 * T037 — create/edit Ingredient form in the shared `Dialog` modal, replacing
 * both the toggled inline "New ingredient" form and the per-row inline edit
 * fields InventoryPage previously used.
 *
 * Field parity with the prior UI is preserved deliberately (Files-Must-Not-
 * Touch guard: no field additions/removals): create edits name/unit/cost/
 * category with a required-field guard; edit edits name/unit/cost only and,
 * like the old inline row-edit, applies no required-field guard. An absent
 * `ingredient` prop means create mode; a present one means edit mode.
 */
export function IngredientFormDialog({
  ingredient,
  onCreated,
  onUpdated,
  onClose,
}: {
  ingredient?: Ingredient | null;
  onCreated: (created: Ingredient) => void;
  onUpdated: (updated: Ingredient) => void;
  onClose: () => void;
}) {
  const isEdit = !!ingredient;
  const [name, setName] = useState(ingredient?.name ?? '');
  const [unit, setUnit] = useState(ingredient?.unit ?? '');
  const [costPerUnit, setCostPerUnit] = useState(ingredient ? String(ingredient.costPerUnit) : '');
  const [category, setCategory] = useState(ingredient?.category ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    // Create keeps its original required-field guard; edit keeps its original
    // behaviour of no guard (pre-filled fields are already non-blank).
    if (!isEdit && (!name.trim() || !unit.trim() || !costPerUnit.trim())) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && ingredient) {
        const updated = await updateIngredient(ingredient.id, {
          name: name.trim(),
          unit: unit.trim(),
          costPerUnit: Number(costPerUnit),
        });
        onUpdated(updated);
      } else {
        const created = await createIngredient({
          name: name.trim(),
          unit: unit.trim(),
          costPerUnit: Number(costPerUnit),
          category: category.trim() || undefined,
        });
        onCreated(created);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ingredient');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog titleId="ingredient-form-dialog-title" onClose={onClose}>
      <h2 id="ingredient-form-dialog-title" className="text-lg font-semibold mb-4">
        {isEdit ? 'Edit Ingredient' : 'New Ingredient'}
      </h2>
      {error && (
        <p className="text-danger text-sm mb-3" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <input
          className="border rounded px-2 py-2 text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Ingredient name"
        />
        <input
          className="border rounded px-2 py-2 text-sm"
          placeholder="Unit (e.g. kg, L)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          aria-label="Ingredient unit"
        />
        <input
          className="border rounded px-2 py-2 text-sm"
          placeholder="Cost per unit"
          type="number"
          value={costPerUnit}
          onChange={(e) => setCostPerUnit(e.target.value)}
          aria-label="Cost per unit"
        />
        {!isEdit && (
          <input
            className="border rounded px-2 py-2 text-sm"
            placeholder="Category (optional)"
            value={category ?? ''}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Ingredient category"
          />
        )}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button
          type="button"
          className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded border bg-surface hover:opacity-80"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded bg-accent text-white hover:opacity-90 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {isEdit ? 'Save Changes' : 'Create Ingredient'}
        </button>
      </div>
    </Dialog>
  );
}
