import type { CompletionPreview } from '../types';

/**
 * T011 — confirmation dialog shown when completing a recipe-linked Task
 * (FR-008). Lists each Ingredient's computed deduction before anything is
 * written; the caller is responsible for calling the confirm/decline
 * handlers (this component performs no network I/O itself). Negative
 * stock is never blocked here — it is flagged with a warning per the
 * Edge Case Checklist ("allow but flag, don't silently block").
 *
 * T035 — `ingredientNameById` resolves each deduction's ingredientId to a
 * human name (fetched via GET /ingredients by the caller). Falls back to
 * the raw id if a name can't be resolved (e.g. deleted ingredient), per
 * the Edge Case Checklist — never crash on a lookup miss.
 */
export function CompleteTaskDialog({
  preview,
  loading,
  onConfirm,
  onCancel,
  ingredientNameById = {},
}: {
  preview: CompletionPreview;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  ingredientNameById?: Record<string, string>;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-task-dialog-title"
    >
      <div className="bg-surface-raised rounded-lg shadow-lg w-full max-w-md p-4 sm:p-6">
        <h2 id="complete-task-dialog-title" className="text-lg font-semibold mb-2">
          Confirm stock deduction
        </h2>
        <p className="text-sm text-muted mb-4">
          Completing this task will deduct the following ingredients:
        </p>

        {preview.hasNegativeWarning && (
          <p className="text-sm text-warning bg-warning/10 border border-warning/40 rounded px-3 py-2 mb-3">
            Warning: at least one ingredient will go below zero on-hand. The
            deduction will still be applied.
          </p>
        )}

        <ul className="divide-y border rounded mb-4">
          {preview.deductions.map((d) => (
            <li
              key={d.ingredientId}
              className="flex items-center justify-between px-3 py-2 text-sm"
              data-testid={`deduction-row-${d.ingredientId}`}
            >
              <span>{ingredientNameById[d.ingredientId] ?? d.ingredientId.slice(0, 8)}</span>
              <span className={d.wouldGoNegative ? 'text-warning font-medium' : ''}>
                -{d.deductQty} (→ {d.resultingStock})
              </span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded border bg-surface hover:opacity-80"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded bg-accent text-white hover:opacity-90 disabled:opacity-50"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
