import { useEffect, type ReactNode } from 'react';

/**
 * T029 — reusable overlay + centered modal primitive, generalized from the
 * visual pattern already used by
 * features/tasks/CompleteTaskDialog/CompleteTaskDialog.tsx (overlay +
 * role="dialog" + semantic tokens). Purely presentational: callers own
 * their own content/state.
 */
export function Dialog({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Accessibility: Escape closes the dialog (Edge Case Checklist).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="bg-surface-raised rounded-lg shadow-lg w-full max-w-md p-4 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
