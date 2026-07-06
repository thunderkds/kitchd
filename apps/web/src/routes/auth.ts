const TOKEN_KEY = 'accessToken';
const USER_KEY = 'authUser';

export type UserRole = 'OWNER' | 'ADMIN' | 'CHEF' | 'STAFF' | 'VIEWER';

export interface StoredUser {
  id: string;
  email: string;
  organizationId: string;
  kitchenId: string;
  role: UserRole;
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

// T018 — Dashboard needs to know the caller's own id + role to decide
// "my tasks" (Staff/Viewer) vs "all Kitchen tasks" (Owner/Admin/Chef).
// Stored alongside the token at login/signup (see LoginPage).
export function setUser(user: StoredUser): void {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): StoredUser | null {
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function clearUser(): void {
  window.localStorage.removeItem(USER_KEY);
}
