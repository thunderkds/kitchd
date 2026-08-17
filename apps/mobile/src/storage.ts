import * as SecureStore from 'expo-secure-store';
import type { SessionStorageAdapter, StoredUser } from '@kitchenos/shared';
import { Platform } from 'react-native';

const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';
const AUTH_USER_STORAGE_KEY = 'authUser';
const NATIVE_SESSION_STORAGE_KEY = 'session';

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
      const rawState = await SecureStore.getItemAsync(NATIVE_SESSION_STORAGE_KEY);
      if (!rawState) {
        nativeSessionState = defaultNativeSessionState();
        return;
      }

      try {
        const parsed = JSON.parse(rawState) as Partial<NativeSessionState>;
        nativeSessionState = {
          accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : null,
          authUser: typeof parsed.authUser === 'string' ? parsed.authUser : null,
        };
      } catch (error) {
        nativeSessionState = defaultNativeSessionState();
        console.warn('Failed to parse native session storage', error);
      }
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
  const serializedUser = JSON.stringify(user);

  if (webStorage) {
    webStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    webStorage.setItem(AUTH_USER_STORAGE_KEY, serializedUser);
    return;
  }

  nativeSessionState = {
    accessToken: token,
    authUser: serializedUser,
  };

  await persistNativeSessionState();
}

export async function clearSession(): Promise<void> {
  if (webStorage) {
    webStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    webStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return;
  }

  nativeSessionState = defaultNativeSessionState();
  await SecureStore.deleteItemAsync(NATIVE_SESSION_STORAGE_KEY);
}
