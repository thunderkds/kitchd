import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ErrorDialog } from './ErrorDialog';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

interface ErrorDialogContextValue {
  message: string | null;
  showError: (message: string) => void;
  clearError: () => void;
}

const ErrorDialogContext = createContext<ErrorDialogContextValue | null>(null);

// Module-level singleton so `notifyApiError()` can be called from
// features/*/api.ts and components/*/api.ts files, which live outside
// React component scope. Set once ErrorDialogProvider mounts (App.tsx).
let showErrorSingleton: ((message: string) => void) | null = null;

/**
 * T029 — call from any api.ts request() helper's error branch (non-2xx
 * response or fetch rejection) to surface the shared blocking error
 * dialog. Falls back to a generic message if none is provided, and is a
 * no-op before ErrorDialogProvider has mounted (should not happen in the
 * running app, but keeps this safe to import anywhere).
 */
export function notifyApiError(message?: string | null): void {
  showErrorSingleton?.(message?.trim() ? message : GENERIC_MESSAGE);
}

export function ErrorDialogProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const showError = (next: string) => {
    // Two failures in quick succession: latest message wins, no stacking
    // (Acceptance Criterion 3).
    setMessage(next);
  };
  const clearError = () => setMessage(null);

  showErrorSingleton = showError;

  const value = useMemo(() => ({ message, showError, clearError }), [message]);

  return (
    <ErrorDialogContext.Provider value={value}>
      {children}
      {message && <ErrorDialog message={message} onClose={clearError} />}
    </ErrorDialogContext.Provider>
  );
}

export function useErrorDialog(): ErrorDialogContextValue {
  const ctx = useContext(ErrorDialogContext);
  if (!ctx) {
    throw new Error('useErrorDialog must be used within an ErrorDialogProvider');
  }
  return ctx;
}
