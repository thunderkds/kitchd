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
 *
 * T041 — added the low-stock threshold input (`minThreshold`), which was
 * missing from both payloads and therefore permanently invisible to
 * AlertsService#lowStock (`gt: 0` filter). Create pre-fills `5`; edit
 * pre-fills the stored value or blank if null. A blank input is sent as
 * `undefined`, never `0` — `Number('')` is `0`, which the alert service's
 * `gt: 0` filter would silently exclude again. Also restored `category` to
 * the edit payload, which this form was dropping.
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
  // Create pre-fills the user's chosen default (5); edit pre-fills the
  // stored value, or blank if the ingredient has none — a save must never
  // invent a threshold the user didn't choose.
  const [minThreshold, setMinThreshold] = useState(
    isEdit ? (ingredient?.minThreshold != null ? String(ingredient.minThreshold) : '') : '5',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Blank -> undefined (never 0 — Number('') is 0, and the alert service
  // filters `gt: 0`, so a naive conversion would re-create this bug).
  // Negative/non-numeric -> null, a sentinel meaning "block the submit".
  const parseThreshold = (): number | undefined | null => {
    const trimmed = minThreshold.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    return parsed;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    // Create keeps its original required-field guard; edit keeps its original
    // behaviour of no guard (pre-filled fields are already non-blank).
    if (!isEdit && (!name.trim() || !unit.trim() || !costPerUnit.trim())) return;
    const parsedThreshold = parseThreshold();
    if (parsedThreshold === null) {
      setError('Low stock threshold must be a non-negative number');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && ingredient) {
        const updated = await updateIngredient(ingredient.id, {
          name: name.trim(),
          unit: unit.trim(),
          costPerUnit: Number(costPerUnit),
          category: category.trim() || undefined,
          minThreshold: parsedThreshold,
        });
        onUpdated(updated);
      } else {
        const created = await createIngredient({
          name: name.trim(),
          unit: unit.trim(),
          costPerUnit: Number(costPerUnit),
          category: category.trim() || undefined,
          minThreshold: parsedThreshold,
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
        <input
          className="border rounded px-2 py-2 text-sm"
          placeholder="Category (optional)"
          value={category ?? ''}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Ingredient category"
        />
        <input
          className="border rounded px-2 py-2 text-sm"
          placeholder="Low stock threshold"
          type="text"
          inputMode="decimal"
          value={minThreshold}
          onChange={(e) => setMinThreshold(e.target.value)}
          aria-label="Low stock threshold"
        />
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
