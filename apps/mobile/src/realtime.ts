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
// True once a socket has connected for the current session. A later `connect` (a new socket after
// backgrounding, or socket.io's own reconnect) must catch up on events the server never replays;
// the first connect after start or login has nothing to catch up on.
let hasConnected = false;
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

  next.on('connect', () => {
    if (hasConnected) {
      void queryClient.invalidateQueries();
    }
    hasConnected = true;
  });

  // A rejected handshake (the gateway maps any auth failure, even a DB blip, to Unauthorized) kills
  // this socket for good: socket.io does not retry it. Drop it so the next `active` builds a fresh
  // one. No retry here (that would loop on a genuinely bad token). The error is never logged.
  next.on('connect_error', () => {
    if (socket === next) {
      disconnect();
    }
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
    // Only `background` closes the socket. iOS reports `inactive` for Control Center, the
    // notification shade and the app-switcher peek, and dropping the connection for those churns it.
    if (state === 'background') {
      disconnect();
      return;
    }

    // `active` (or `inactive` -> `active`) reconnects only when there is no socket.
    if (state === 'active' && !socket) {
      connect();
    }
  });
  const unsubscribeSession = onSessionChange(() => {
    // Login or logout: a different session, so its first connect is a first connect again.
    hasConnected = false;
    connect();
  });

  connect();

  stop = () => {
    appStateSubscription.remove();
    unsubscribeSession();
    disconnect();
    hasConnected = false;
    stop = null;
  };

  return stop;
}
