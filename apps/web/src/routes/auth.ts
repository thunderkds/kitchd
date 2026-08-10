import { createSessionStore } from '@kitchenos/shared';

const session = createSessionStore(window.localStorage);

export const {
  getToken,
  setToken,
  clearToken,
  isAuthenticated,
  setUser,
  getUser,
  clearUser,
} = session;

export type { StoredUser, UserRole } from '@kitchenos/shared';
