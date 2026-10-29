import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { API_BASE } from './apiBase';
import { queryClient } from './queryClient';
import { commentKeys, queryKeys } from './queryKeys';
import { session } from './session';
import { onSessionChange } from './storage';

// Each realtime event maps to the query prefixes it makes stale. There is no task-detail key, so
// the `tasks` prefix covers both the list and any detail query. A new comment can mention a user,
// which creates a notification, hence `notifications` too.
const EVENT_INVALIDATIONS: Record<string, ReadonlyArray<readonly unknown[]>> = {
  'task.updated': [queryKeys.tasks.all],
  'comment.created': [commentKeys.all, queryKeys.notifications.all],
  'announcement.created': [queryKeys.announcements.all],
};

let socket: Socket | null = null;
let stop: (() => void) | null = null;

function disconnect(): void {
  if (!socket) {
    return;
  }

  // Detach first so nothing from a closing socket can touch the cache after this point.
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

function connect(): void {
  // Always replace: the token may have changed (another user logged in), and a socket opened
  // for the previous token must not survive.
  disconnect();

  if (!session.getToken() || AppState.currentState !== 'active') {
    return;
  }

  // `auth` is a callback so socket.io re-reads the token on every (re)connection attempt rather
  // than holding the one captured here.
  const next = io(API_BASE, {
    auth: (callback) => callback({ token: session.getToken() ?? '' }),
  });

  for (const [event, keys] of Object.entries(EVENT_INVALIDATIONS)) {
    next.on(event, () => {
      for (const queryKey of keys) {
        void queryClient.invalidateQueries({ queryKey });
      }
    });
  }

  socket = next;
}

// Starts the realtime lifecycle: connect now if signed in and foregrounded, close in the
// background, reconnect on foreground, follow login/logout. Returns a function that undoes it all.
export function startRealtime(): () => void {
  if (stop) {
    return stop;
  }

  const appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      // Repeated 'active' events must not stack sockets.
      if (!socket) {
        connect();
      }
      return;
    }

    disconnect();
  });
  const unsubscribeSession = onSessionChange(connect);

  connect();

  stop = () => {
    appStateSubscription.remove();
    unsubscribeSession();
    disconnect();
    stop = null;
  };

  return stop;
}
