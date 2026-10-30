import * as SecureStore from 'expo-secure-store';
import {
  ACCESS_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  type SessionStorageAdapter,
  type StoredUser,
} from '@kitchenos/shared';
import { Platform } from 'react-native';
import { queryClient } from './queryClient';

const NATIVE_SESSION_STORAGE_KEY = 'session';
const LEGACY_ACCESS_TOKEN_STORAGE_KEY = ACCESS_TOKEN_STORAGE_KEY;
const LEGACY_AUTH_USER_STORAGE_KEY = AUTH_USER_STORAGE_KEY;

type NativeSessionState = {
  accessToken: string | null;
  authUser: string | null;
};

function defaultNativeSessionState(): NativeSessionState {
  return {
    accessToken: null,
    authUser: null,
  };
}

let nativeSessionState = defaultNativeSessionState();
// Bumped on every in-memory write. Hydration compares it to detect a write that landed while
// the initial SecureStore read was in flight, so the older stored blob cannot overwrite it.
let nativeWriteVersion = 0;
let nativeHydration: Promise<void> | null = null;

function createWebStorage(): SessionStorageAdapter | null {
  if (Platform.OS !== 'web') {
    return null;
  }

  const storage = globalThis.localStorage;
  if (!storage) {
    return null;
  }

  return {
    getItem(key: string) {
      return storage.getItem(key);
    },
    setItem(key: string, value: string) {
      storage.setItem(key, value);
    },
    removeItem(key: string) {
      storage.removeItem(key);
    },
  };
}

function persistNativeSessionState(): Promise<void> {
  return SecureStore.setItemAsync(NATIVE_SESSION_STORAGE_KEY, JSON.stringify(nativeSessionState));
}

function loadNativeStorage(): Promise<void> {
  if (!nativeHydration) {
    nativeHydration = (async () => {
      const versionAtStart = nativeWriteVersion;
      const rawState = await SecureStore.getItemAsync(NATIVE_SESSION_STORAGE_KEY);
      if (nativeWriteVersion !== versionAtStart) {
        return;
      }

      if (rawState) {
        try {
          const parsed = JSON.parse(rawState) as Partial<NativeSessionState>;
          nativeSessionState = {
            accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : null,
            authUser: typeof parsed.authUser === 'string' ? parsed.authUser : null,
          };
          return;
        } catch (error) {
          nativeSessionState = defaultNativeSessionState();
          // The error name only: V8 quotes short input in the message, and this input holds the token.
          console.warn('Failed to parse native session storage', error instanceof Error ? error.name : 'unknown error');
          return;
        }
      }

      const [legacyAccessToken, legacyAuthUser] = await Promise.all([
        SecureStore.getItemAsync(LEGACY_ACCESS_TOKEN_STORAGE_KEY),
        SecureStore.getItemAsync(LEGACY_AUTH_USER_STORAGE_KEY),
      ]);

      if (nativeWriteVersion !== versionAtStart) {
        return;
      }

      if (legacyAccessToken || legacyAuthUser) {
        nativeSessionState = {
          accessToken: legacyAccessToken,
          authUser: legacyAuthUser,
        };
        await persistNativeSessionState();
        await Promise.all([
          SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_STORAGE_KEY),
          SecureStore.deleteItemAsync(LEGACY_AUTH_USER_STORAGE_KEY),
        ]);
        return;
      }

      nativeSessionState = defaultNativeSessionState();
    })().catch((error) => {
      console.warn('Failed to hydrate native session storage', error);
    });
  }

  return nativeHydration;
}

function createNativeStorage(): SessionStorageAdapter {
  void loadNativeStorage();

  return {
    getItem(key: string) {
      if (key === ACCESS_TOKEN_STORAGE_KEY) {
        return nativeSessionState.accessToken;
      }

      if (key === AUTH_USER_STORAGE_KEY) {
        return nativeSessionState.authUser;
      }

      return null;
    },
    setItem(key: string, value: string) {
      nativeWriteVersion += 1;
      if (key === ACCESS_TOKEN_STORAGE_KEY) {
        nativeSessionState.accessToken = value;
      } else if (key === AUTH_USER_STORAGE_KEY) {
        nativeSessionState.authUser = value;
      }

      void persistNativeSessionState().catch((error) => {
        console.warn('Failed to persist native session storage', error);
      });
    },
    removeItem(key: string) {
      nativeWriteVersion += 1;
      if (key === ACCESS_TOKEN_STORAGE_KEY) {
        nativeSessionState.accessToken = null;
      } else if (key === AUTH_USER_STORAGE_KEY) {
        nativeSessionState.authUser = null;
      }

      void persistNativeSessionState().catch((error) => {
        console.warn('Failed to persist native session storage', error);
      });
    },
  };
}

const webStorage = createWebStorage();

// Subscribers (realtime) that must react to the token changing. Every login/logout path funnels
// through persistSession/clearSession, so notifying from here covers them all, including the 401
// path in request(). Listeners run synchronously so a socket is closed before clearSession awaits.
type SessionChangeListener = () => void;
const sessionChangeListeners = new Set<SessionChangeListener>();

export function onSessionChange(listener: SessionChangeListener): () => void {
  sessionChangeListeners.add(listener);
  return () => {
    sessionChangeListeners.delete(listener);
  };
}

function notifySessionChange(): void {
  for (const listener of [...sessionChangeListeners]) {
    try {
      listener();
    } catch (error) {
      // A failing subscriber must never block login or, worse, logout. Message only, never the token.
      console.warn('Session change listener failed', error instanceof Error ? error.message : 'unknown error');
    }
  }
}

export const sessionReady = webStorage ? Promise.resolve() : loadNativeStorage();

export function createSessionStorage(): SessionStorageAdapter {
  return webStorage ?? createNativeStorage();
}

export async function persistSession(token: string, user: StoredUser): Promise<void> {
  // A new session means a possibly different user: drop whatever the previous one had cached.
  queryClient.clear();
  const serializedUser = JSON.stringify(user);

  if (webStorage) {
    webStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    webStorage.setItem(AUTH_USER_STORAGE_KEY, serializedUser);
    notifySessionChange();
    return;
  }

  nativeWriteVersion += 1;
  nativeSessionState = {
    accessToken: token,
    authUser: serializedUser,
  };
  notifySessionChange();

  await persistNativeSessionState();
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_STORAGE_KEY),
    SecureStore.deleteItemAsync(LEGACY_AUTH_USER_STORAGE_KEY),
  ]);
}

export async function clearSession(): Promise<void> {
  // Every logout path (sign-out button, 401 in request()) ends here. Clear the cache first so it
  // is dropped even if wiping the stored session below throws.
  queryClient.clear();

  if (webStorage) {
    webStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    webStorage.removeItem(AUTH_USER_STORAGE_KEY);
    notifySessionChange();
    return;
  }

  nativeWriteVersion += 1;
  nativeSessionState = defaultNativeSessionState();
  // Before the awaited SecureStore deletes, so the socket closes even if they throw.
  notifySessionChange();

  // Legacy keys first: if one survives and `session` is gone, the next hydration would migrate it
  // back into a live session. A surviving legacy key therefore keeps `session` as an empty blob.
  const legacyDeletes = await Promise.allSettled([
    SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_STORAGE_KEY),
    SecureStore.deleteItemAsync(LEGACY_AUTH_USER_STORAGE_KEY),
  ]);
  let sessionGone = legacyDeletes.every((result) => result.status === 'fulfilled');
  if (sessionGone) {
    try {
      await SecureStore.deleteItemAsync(NATIVE_SESSION_STORAGE_KEY);
    } catch {
      sessionGone = false;
    }
  }

  if (!sessionGone) {
    // Cannot remove everything, so overwrite the stored token with the empty state instead. Memory
    // is already cleared above, so a failure here must not make logout look like it failed.
    try {
      await persistNativeSessionState();
    } catch (error) {
      console.warn('Failed to clear native session storage', error instanceof Error ? error.message : 'unknown error');
    }
  }
}
