import { useEffect, useState } from 'react';
import { fetchLowStock, type LowStockIngredient } from './api';

/**
 * T007 — standalone low-stock alert widget (FR-010). Fetches
 * GET /inventory/alerts/low-stock and renders below-threshold Ingredients
 * with an amber/red warning treatment. Composed into the Dashboard by
 * T018 — this component performs its own fetch and has no dependency on
 * a Dashboard shell.
 */
export function LowStockWidget() {
  const [ingredients, setIngredients] = useState<LowStockIngredient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLowStock()
      .then((data) => {
        if (!cancelled) setIngredients(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border rounded-lg p-4 w-full" data-testid="low-stock-widget">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Low Stock</h3>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {!error && ingredients === null && (
        <p className="text-sm text-gray-500">Loading…</p>
      )}

      {!error && ingredients !== null && ingredients.length === 0 && (
        <p className="text-sm text-gray-500" data-testid="low-stock-empty">
          All ingredients are above their thresholds.
        </p>
      )}

      {!error && ingredients !== null && ingredients.length > 0 && (
        <ul className="divide-y">
          {ingredients.map((ingredient) => {
            const isCritical =
              ingredient.minThreshold != null &&
              ingredient.currentStock <= ingredient.minThreshold / 2;
            return (
              <li
                key={ingredient.id}
                data-testid={`low-stock-row-${ingredient.id}`}
                className={`flex items-center justify-between px-1 py-2 text-sm rounded ${
                  isCritical
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                <span>{ingredient.name}</span>
                <span>
                  {ingredient.currentStock} {ingredient.unit} (min{' '}
                  {ingredient.minThreshold})
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
