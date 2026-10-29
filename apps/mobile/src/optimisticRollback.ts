import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { session } from './session';

// An optimistic mutation snapshots the cache in onMutate and restores it in onError. If the session
// ended in between (logout, a 401, another user signing in), queryClient.clear() already dropped the
// previous user's data and restoring the snapshot would put it back. Capture the session token when the
// mutation starts and restore only while that session is still the current one.
export function sessionTokenAtStart(): string | null {
  return session.getToken();
}

export function restoreIfSessionUnchanged(
  queryClient: QueryClient,
  key: QueryKey,
  previous: unknown,
  tokenAtStart: string | null,
): void {
  if (session.getToken() !== tokenAtStart) {
    return;
  }

  // A cleared cache has no query for the key; do not recreate one just to hold stale data.
  if (!queryClient.getQueryState(key)) {
    return;
  }

  queryClient.setQueryData(key, previous);
}
