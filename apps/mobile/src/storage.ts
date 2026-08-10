import * as SecureStore from 'expo-secure-store';
import type { SessionStorageAdapter } from '@kitchenos/shared';
import { Platform } from 'react-native';

const PERSISTED_KEYS = ['accessToken', 'authUser'] as const;
const nativeCache = new Map<string, string>();
let nativeHydration: Promise<void> | null = null;

function createMemoryStorage(): SessionStorageAdapter {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

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

function loadNativeStorage(): Promise<void> {
  if (!nativeHydration) {
    nativeHydration = (async () => {
      const entries = await Promise.all(
        PERSISTED_KEYS.map(async (key) => {
          const value = await SecureStore.getItemAsync(key);
          return [key, value] as const;
        }),
      );

      for (const [key, value] of entries) {
        if (value !== null) {
          nativeCache.set(key, value);
        }
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
      return nativeCache.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      nativeCache.set(key, value);
      void SecureStore.setItemAsync(key, value).catch((error) => {
        console.warn(`Failed to persist session value for ${key}`, error);
      });
    },
    removeItem(key: string) {
      nativeCache.delete(key);
      void SecureStore.deleteItemAsync(key).catch((error) => {
        console.warn(`Failed to remove session value for ${key}`, error);
      });
    },
  };
}

const webStorage = createWebStorage();

export const sessionReady = webStorage ? Promise.resolve() : loadNativeStorage();

export function createSessionStorage(): SessionStorageAdapter {
  return webStorage ?? createNativeStorage();
}
