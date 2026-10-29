import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ThemePreferenceId } from '@kitchenos/shared';
import { session } from './session';

// Minimal palette only (M006): the web's full CSS-token system is deliberately not reproduced.
// `border` is the one extra role: cards need an edge that reads on both a light and a dark surface.
export interface Palette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  danger: string;
  border: string;
}

export const DEFAULT_THEME: ThemePreferenceId = 'simple';

export const PALETTES: Record<ThemePreferenceId, Palette> = {
  simple: {
    background: '#f6f7fb',
    surface: '#ffffff',
    text: '#14192b',
    muted: '#5b6478',
    accent: '#3d5afe',
    danger: '#c62828',
    border: '#d8dcea',
  },
  // The look the mobile screens shipped with.
  'dark-neon': {
    background: '#0d1016',
    surface: '#171c26',
    text: '#f4f7ff',
    muted: '#9ca9bf',
    accent: '#6b8cff',
    danger: '#ff8c8c',
    border: '#273044',
  },
};

export const THEME_OPTIONS: { id: ThemePreferenceId; label: string; description: string }[] = [
  { id: 'simple', label: 'Simple', description: "KitchenOS's original light theme." },
  { id: 'dark-neon', label: 'Dark Neon', description: 'A high-contrast dark theme with a neon accent.' },
];

function isThemePreference(value: unknown): value is ThemePreferenceId {
  return value === 'simple' || value === 'dark-neon';
}

// Stored preference -> palette. Anything missing or unknown renders the default, never unstyled.
// `system` is not offered: update-theme.dto.ts only accepts the Prisma Theme enum (simple | dark_neon).
export function resolvePalette(preference: string | null | undefined): Palette {
  return PALETTES[isThemePreference(preference) ? preference : DEFAULT_THEME];
}

// The API speaks the Prisma enum (snake_case); the app stores the kebab-case id.
export function toApiTheme(preference: ThemePreferenceId): 'simple' | 'dark_neon' {
  return preference === 'dark-neon' ? 'dark_neon' : 'simple';
}

export interface ThemeStore {
  getPreference(): ThemePreferenceId;
  setPreference(preference: ThemePreferenceId): void;
  subscribe(listener: () => void): () => void;
}

// The stored user (src/session.ts) is the source of truth, so the preference survives restarts and
// is read fresh whenever a screen mounts (including right after sign-in). The store only adds
// change notification so mounted screens re-render when Settings saves a new value.
export function createThemeStore(): ThemeStore {
  const listeners = new Set<() => void>();

  return {
    getPreference() {
      const stored = session.getUser()?.themePreference;
      return isThemePreference(stored) ? stored : DEFAULT_THEME;
    },
    setPreference(preference) {
      const user = session.getUser();
      if (user) {
        session.setUser({ ...user, themePreference: preference });
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const themeStore = createThemeStore();

// The context carries the store (a stable object), not the resolved value, so a provider mounted
// once at the root never goes stale across sign-out / sign-in.
export const ThemeContext = createContext<ThemeStore>(themeStore);

export function useTheme(): {
  preference: ThemePreferenceId;
  palette: Palette;
  setPreference: (preference: ThemePreferenceId) => void;
} {
  const store = useContext(ThemeContext);
  const preference = useSyncExternalStore(store.subscribe, store.getPreference, store.getPreference);
  return { preference, palette: resolvePalette(preference), setPreference: store.setPreference };
}
