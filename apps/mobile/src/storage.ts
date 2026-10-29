import * as SecureStore from 'expo-secure-store';
import type { SessionStorageAdapter, StoredUser } from '@kitchenos/shared';
import { Platform } from 'react-native';
import { queryClient } from './queryClient';

const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';
const AUTH_USER_STORAGE_KEY = 'authUser';
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
          console.warn('Failed to parse native session storage', error);
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
    return;
  }

  nativeWriteVersion += 1;
  nativeSessionState = {
    accessToken: token,
    authUser: serializedUser,
  };

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
    return;
  }

  nativeWriteVersion += 1;
  nativeSessionState = defaultNativeSessionState();
  await SecureStore.deleteItemAsync(NATIVE_SESSION_STORAGE_KEY);
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_STORAGE_KEY),
    SecureStore.deleteItemAsync(LEGACY_AUTH_USER_STORAGE_KEY),
  ]);
}
