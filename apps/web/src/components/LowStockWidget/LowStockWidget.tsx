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
    <div className="border bg-surface-raised rounded-lg p-4 w-full" data-testid="low-stock-widget">
      <h3 className="text-sm font-semibold text-primary mb-3">Low Stock</h3>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {!error && ingredients === null && (
        <p className="text-sm text-muted">Loading…</p>
      )}

      {!error && ingredients !== null && ingredients.length === 0 && (
        <p className="text-sm text-muted" data-testid="low-stock-empty">
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
                className={`flex items-center justify-between gap-2 px-1 py-2 text-sm rounded ${
                  isCritical
                    ? 'bg-danger/10 text-danger'
                    : 'bg-warning/10 text-warning'
                }`}
              >
                <span className="truncate min-w-0">{ingredient.name}</span>
                <span className="shrink-0 whitespace-nowrap">
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
