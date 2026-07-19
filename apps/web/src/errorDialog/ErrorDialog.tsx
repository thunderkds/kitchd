import { Dialog } from '../components/Dialog/Dialog';

/**
 * T029 — the shared blocking modal shown for every API/network failure
 * app-wide. Renders the server's message (or the generic fallback already
 * applied by notifyApiError) with a single dismiss action.
 */
export function ErrorDialog({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <Dialog titleId="error-dialog-title" onClose={onClose}>
      <h2 id="error-dialog-title" className="text-lg font-semibold mb-2 text-danger">
        Something went wrong
      </h2>
      <p className="text-sm text-muted mb-4" data-testid="error-dialog-message">
        {message}
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          className="text-sm px-3 py-2 min-h-[44px] min-w-[44px] rounded bg-accent text-white hover:opacity-90"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </Dialog>
  );
}
