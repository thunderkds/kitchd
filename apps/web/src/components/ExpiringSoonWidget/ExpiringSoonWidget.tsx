import { useEffect, useState } from 'react';
import { fetchExpiringSoon, type ExpiringSoonBatch } from './api';

function formatExpiryDate(value: string | null): string {
  if (!value) return 'No expiry date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * T007/T045 — expiring-soon alert widget. Fetches
 * GET /inventory/alerts/expiring and renders StockBatches nearing expiry
 * with the same loading/error/empty shape as LowStockWidget.
 */
export function ExpiringSoonWidget() {
  const [batches, setBatches] = useState<ExpiringSoonBatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExpiringSoon()
      .then((data) => {
        if (!cancelled) setBatches(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border bg-surface-raised rounded-lg p-4 w-full" data-testid="expiring-soon-widget">
      <h3 className="text-sm font-semibold text-primary mb-3">Expiring Soon</h3>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {!error && batches === null && <p className="text-sm text-muted">Loading…</p>}

      {!error && batches !== null && batches.length === 0 && (
        <p className="text-sm text-muted" data-testid="expiring-soon-empty">
          No batches are expiring soon.
        </p>
      )}

      {!error && batches !== null && batches.length > 0 && (
        <ul className="divide-y">
          {batches.map((batch) => (
            <li
              key={batch.id}
              data-testid={`expiring-soon-row-${batch.id}`}
              className="flex items-center justify-between gap-2 px-1 py-2 text-sm rounded bg-warning/10 text-warning"
            >
              <span className="truncate min-w-0">
                {batch.ingredient.name}
                {batch.location ? ` · ${batch.location}` : ''}
              </span>
              <span className="shrink-0 whitespace-nowrap">
                {batch.qty} {batch.ingredient.unit} · {formatExpiryDate(batch.expiryDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
