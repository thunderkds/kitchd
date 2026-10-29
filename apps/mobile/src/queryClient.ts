import { AppState } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

const NO_RETRY_STATUSES = [401, 403, 404];

// 401/403/404 are answers, not transient failures: retrying cannot change them (and a 401 has
// already cleared the session). Anything else gets a single retry.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && NO_RETRY_STATUSES.includes(status)) {
    return false;
  }

  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
    },
  });
}

// On mobile "focused" means the app is in the foreground, not a browser tab being visible.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });

  return () => subscription.remove();
});

export const queryClient = createQueryClient();
