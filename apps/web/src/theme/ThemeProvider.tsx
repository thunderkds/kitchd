import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getToken, getUser, setUser } from '../routes/auth';
import { DEFAULT_THEME, idToApiTheme, type ThemeId } from './themeMapping';

// Paint-time cache only — NOT the source of truth. The account's
// themePreference (read via the logged-in user object; there is no
// /auth/me route in this codebase, see memory/learnings.md) is always the
// source of truth once auth resolves. This key is also read synchronously
// by the inline script in index.html, before any JS module loads, to set
// data-theme on <html> before first paint (Acceptance Criterion 3).
const STORAGE_KEY = 'kitchenos-theme';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readCachedTheme(): ThemeId {
  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (cached === 'simple' || cached === 'dark-neon') return cached;
  } catch {
    // localStorage may be unavailable (e.g. private mode) — cache is
    // best-effort only, fall back silently.
  }
  return DEFAULT_THEME;
}

function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // best-effort cache write
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => readCachedTheme());

  // Reconcile the pre-paint cached guess with the authenticated user's
  // account-level themePreference. Logged-out views (e.g. /login) have no
  // stored user, so they render in Simple (Acceptance Criterion 5) with no
  // network call. Runs once on mount — a fresh login/signup re-mounts the
  // app tree via navigate(), so this re-runs on the next mount, and the
  // in-page switch below updates state directly without needing a re-run.
  useEffect(() => {
    const user = getUser();
    const accountTheme = user?.themePreference ?? DEFAULT_THEME;
    setThemeState(accountTheme);
    applyTheme(accountTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = async (next: ThemeId): Promise<void> => {
    const previous = theme;
    const user = getUser();

    // Optimistic: apply immediately (Acceptance Criterion 4).
    setThemeState(next);
    applyTheme(next);
    if (user) setUser({ ...user, themePreference: next });

    if (!user) return; // no account to persist against (shouldn't happen —
    // the switcher only renders on the authenticated settings page — but
    // guard rather than throw.

    try {
      const res = await fetch(`${API_BASE}/users/me/theme`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken() ?? ''}`,
        },
        body: JSON.stringify({ theme: idToApiTheme(next) }),
      });
      if (!res.ok) throw new Error('Failed to update theme preference');
    } catch {
      // Roll back the optimistic update on failure.
      setThemeState(previous);
      applyTheme(previous);
      setUser({ ...user, themePreference: previous });
    }
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
