import { useEffect, useState } from 'react';
import {
  createIngredient,
  currentStockFromMovements,
  listIngredients,
  listMovements,
  receiveStock,
  updateIngredient,
} from './api';
import { getUser } from '../../routes/auth';
import type { UserRole } from '../../routes/auth';
import type { Ingredient } from './types';

const WRITE_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'CHEF'];

interface IngredientRow extends Ingredient {
  currentStock: number | null;
}

/**
 * Inventory page (T031). Consumes T004's Ingredient/StockBatch/StockMovement
 * endpoints. GET /ingredients is open to every authenticated role (unlike
 * T028's Team page) — only writes (create/update/receive) are gated to
 * Owner/Admin/Chef, matching backend WRITE_ROLES. Write controls are only
 * rendered for those roles, so a Staff/Viewer caller never triggers a write
 * fetch at all (mirrors T028's "gate the fetch, not just the UI" pattern).
 */
export function InventoryPage() {
  const caller = getUser();
  const canManage = !!caller && WRITE_ROLES.includes(caller.role);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [category, setCategory] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCost, setEditCost] = useState('');

  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listIngredients();
      const rows: IngredientRow[] = await Promise.all(
        data.map(async (ingredient) => {
          try {
            const movements = await listMovements(ingredient.id);
            return { ...ingredient, currentStock: currentStockFromMovements(movements) };
          } catch {
            return { ...ingredient, currentStock: null };
          }
        }),
      );
      setIngredients(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    if (!name.trim() || !unit.trim() || !costPerUnit.trim()) return;
    try {
      const created = await createIngredient({
        name: name.trim(),
        unit: unit.trim(),
        costPerUnit: Number(costPerUnit),
        category: category.trim() || undefined,
      });
      setIngredients((prev) => [...prev, { ...created, currentStock: 0 }]);
      setName('');
      setUnit('');
      setCostPerUnit('');
      setCategory('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ingredient');
    }
  };

  const startEdit = (ingredient: IngredientRow) => {
    setEditingId(ingredient.id);
    setEditName(ingredient.name);
    setEditUnit(ingredient.unit);
    setEditCost(String(ingredient.costPerUnit));
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const updated = await updateIngredient(id, {
        name: editName.trim(),
        unit: editUnit.trim(),
        costPerUnit: Number(editCost),
      });
      setIngredients((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updated } : i)),
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ingredient');
    }
  };

  const startReceive = (id: string) => {
    setReceivingId(id);
    setReceiveQty('');
  };

  const handleReceive = async (id: string) => {
    const qty = Number(receiveQty);
    if (!qty || qty <= 0) return;
    try {
      await receiveStock(id, { qty });
      const movements = await listMovements(id);
      const stock = currentStockFromMovements(movements);
      setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, currentStock: stock } : i)));
      setReceivingId(null);
      setReceiveQty('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record stock receipt');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Inventory</h1>
        {canManage && (
          <button
            type="button"
            className="px-3 py-2 text-sm rounded bg-accent text-white"
            onClick={() => setShowAddForm((prev) => !prev)}
          >
            Add Ingredient
          </button>
        )}
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      {canManage && showAddForm && (
        <div className="border rounded p-4 mb-6 flex flex-col gap-2 max-w-xl">
          <h2 className="text-sm font-medium">New ingredient</h2>
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
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Ingredient category"
          />
          <button
            type="button"
            className="self-start px-3 py-2 text-sm rounded bg-accent text-white"
            onClick={handleAdd}
          >
            Save Ingredient
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading ingredients…</p>
      ) : ingredients.length === 0 ? (
        <p className="text-muted text-sm">No ingredients yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="ingredients-list">
          {ingredients.map((ingredient) => (
            <li
              key={ingredient.id}
              className="border bg-surface-raised rounded p-3 flex items-center justify-between gap-3 flex-wrap"
              data-testid={`ingredient-${ingredient.id}`}
            >
              {editingId === ingredient.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label={`Edit name for ${ingredient.name}`}
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm w-20"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    aria-label={`Edit unit for ${ingredient.name}`}
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm w-24"
                    type="number"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    aria-label={`Edit cost for ${ingredient.name}`}
                  />
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => handleSaveEdit(ingredient.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="font-medium break-words">{ingredient.name}</p>
                  <p className="text-xs text-muted">
                    Stock: {ingredient.currentStock ?? '—'} {ingredient.unit} · Cost: {ingredient.costPerUnit}/{ingredient.unit}
                  </p>
                </div>
              )}

              {canManage && editingId !== ingredient.id && (
                <div className="flex items-center gap-2 shrink-0">
                  {receivingId === ingredient.id ? (
                    <>
                      <input
                        className="border rounded px-2 py-1 text-xs w-20"
                        type="number"
                        placeholder="Qty"
                        value={receiveQty}
                        onChange={(e) => setReceiveQty(e.target.value)}
                        aria-label={`Receive quantity for ${ingredient.name}`}
                      />
                      <button
                        type="button"
                        className="text-xs px-2 py-1 border rounded"
                        onClick={() => handleReceive(ingredient.id)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 border rounded"
                        onClick={() => setReceivingId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 border rounded"
                        onClick={() => startEdit(ingredient)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 border rounded"
                        onClick={() => startReceive(ingredient.id)}
                      >
                        Receive Stock
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
