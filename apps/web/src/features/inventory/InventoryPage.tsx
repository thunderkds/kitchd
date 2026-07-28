import { useEffect, useState } from 'react';
import {
  currentStockFromMovements,
  listIngredients,
  listMovements,
  receiveStock,
} from './api';
import { IngredientFormDialog } from './IngredientFormDialog';
import { getUser } from '../../routes/auth';
import type { UserRole } from '../../routes/auth';
import type { Ingredient } from './types';

const WRITE_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'CHEF'];

interface IngredientRow extends Ingredient {
  currentStock: number | null;
}

/**
 * Inventory page (T031, modal-converted in T037). Consumes T004's
 * Ingredient/StockBatch/StockMovement endpoints. GET /ingredients is open to
 * every authenticated role (unlike T028's Team page) — only writes
 * (create/update/receive) are gated to Owner/Admin/Chef, matching backend
 * WRITE_ROLES. Write controls are only rendered for those roles, so a
 * Staff/Viewer caller never triggers a write fetch at all (mirrors T028's
 * "gate the fetch, not just the UI" pattern).
 *
 * Create ("Add Ingredient") and per-row "Edit" now open the shared `Dialog`
 * modal (IngredientFormDialog) instead of a toggled inline form / inline row
 * fields. The separate per-row stock-receive flow is unchanged.
 */
export function InventoryPage() {
  const caller = getUser();
  const canManage = !!caller && WRITE_ROLES.includes(caller.role);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientRow | null>(null);

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

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (ingredient: IngredientRow) => {
    if (!canManage) return;
    setEditing(ingredient);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleCreated = (created: Ingredient) => {
    setIngredients((prev) => [...prev, { ...created, currentStock: 0 }]);
  };

  const handleUpdated = (updated: Ingredient) => {
    setIngredients((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
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
            onClick={openCreate}
          >
            Add Ingredient
          </button>
        )}
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

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
              <div className="min-w-0">
                <p className="font-medium break-words">{ingredient.name}</p>
                <p className="text-xs text-muted">
                  Stock: {ingredient.currentStock ?? '—'} {ingredient.unit} · Cost: {ingredient.costPerUnit}/{ingredient.unit}
                  {ingredient.minThreshold != null && ` · Min: ${ingredient.minThreshold} ${ingredient.unit}`}
                </p>
              </div>

              {canManage && (
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
                        onClick={() => openEdit(ingredient)}
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

      {canManage && formOpen && (
        <IngredientFormDialog
          ingredient={editing}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
