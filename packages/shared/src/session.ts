export type UserRole = 'OWNER' | 'ADMIN' | 'CHEF' | 'STAFF' | 'VIEWER';

export type ThemePreferenceId = 'simple' | 'dark-neon';

export const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';
export const AUTH_USER_STORAGE_KEY = 'authUser';

export interface StoredUser {
  id: string;
  email: string;
  organizationId: string;
  kitchenId: string;
  role: UserRole;
  themePreference?: ThemePreferenceId;
}

export interface AuthUserDto {
  id: string;
  email: string;
  organizationId: string;
  kitchenId: string;
  role: UserRole;
  themePreference?: string | null;
}

export interface SessionStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SessionStore {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
  isAuthenticated(): boolean;
  setUser(user: StoredUser): void;
  getUser(): StoredUser | null;
  clearUser(): void;
}

function readJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function createSessionStore(storage: SessionStorageAdapter): SessionStore {
  return {
    getToken() {
      return storage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    },
    setToken(token: string) {
      storage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    },
    clearToken() {
      storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    },
    isAuthenticated() {
      return Boolean(storage.getItem(ACCESS_TOKEN_STORAGE_KEY));
    },
    setUser(user: StoredUser) {
      storage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    },
    getUser() {
      return readJson<StoredUser>(storage.getItem(AUTH_USER_STORAGE_KEY));
    },
    clearUser() {
      storage.removeItem(AUTH_USER_STORAGE_KEY);
    },
  };
}
