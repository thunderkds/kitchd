import type { CompletionPreview } from '../types';

/**
 * T011 — confirmation dialog shown when completing a recipe-linked Task
 * (FR-008). Lists each Ingredient's computed deduction before anything is
 * written; the caller is responsible for calling the confirm/decline
 * handlers (this component performs no network I/O itself). Negative
 * stock is never blocked here — it is flagged with a warning per the
 * Edge Case Checklist ("allow but flag, don't silently block").
 */
export function CompleteTaskDialog({
  preview,
  loading,
  onConfirm,
  onCancel,
}: {
  preview: CompletionPreview;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-task-dialog-title"
    >
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 sm:p-6">
        <h2 id="complete-task-dialog-title" className="text-lg font-semibold mb-2">
          Confirm stock deduction
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Completing this task will deduct the following ingredients:
        </p>

        {preview.hasNegativeWarning && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
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
              <span>{d.ingredientId.slice(0, 8)}</span>
              <span className={d.wouldGoNegative ? 'text-amber-700 font-medium' : ''}>
                -{d.deductQty} (→ {d.resultingStock})
              </span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded border bg-gray-50 hover:bg-gray-100"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
