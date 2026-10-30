import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ThemePreferenceId } from '@kitchenos/shared';
import { session } from './session';

// Minimal palette only (M006): the web's full CSS-token system is deliberately not reproduced.
// `border` and `accentSoft` are two roles beyond the guide's six: cards need an edge, and the
// legacy screens use a lighter accent for kickers than for buttons. `onAccent` (M022) is the text or
// icon colour drawn ON an accent fill: white on Simple's blue, dark on Graphite Mint's neon mint.
export interface Palette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  danger: string;
  border: string;
  onAccent: string;
  // M023: the eight roles that fold the leftover hard-coded colours (inputs, rules, secondary text,
  // statuses, selected panels) into the palette. Simple keeps the most-used shade of each group.
  inputBackground: string;
  inputBorder: string;
  divider: string;
  textSecondary: string;
  hint: string;
  warning: string;
  success: string;
  raised: string;
}

export const DEFAULT_THEME: ThemePreferenceId = 'simple';

export const PALETTES: Record<ThemePreferenceId, Palette> = {
  // Exactly the colours the screens hard-coded before M006, so a default user sees no change.
  simple: {
    background: '#0d1016',
    surface: '#171c26',
    text: '#f4f7ff',
    muted: '#9ca9bf',
    accent: '#6b8cff',
    accentSoft: '#86a0ff',
    danger: '#ff8c8c',
    border: '#273044',
    onAccent: '#ffffff',
    inputBackground: '#101521',
    inputBorder: '#2d374b',
    divider: '#222b3a',
    textSecondary: '#ccd5e6',
    hint: '#8f9db4',
    warning: '#ffd27a',
    success: '#93e0a6',
    raised: '#1d2740',
  },
  // Graphite Mint (M022; docs/design/graphite-mint/tokens.json). The id stays `dark-neon` so stored
  // preferences and the API enum are untouched. `surface` is bg-raised: mobile cards keep a fill.
  'dark-neon': {
    background: '#121413',
    surface: '#181B1A',
    text: '#DCE0DD',
    muted: '#8C9590',
    accent: '#3CF5A8',
    accentSoft: '#7EDDB0',
    danger: '#E8968F',
    border: '#262B29',
    onAccent: '#0E100F',
    inputBackground: '#0E100F', // bg-sunken
    inputBorder: '#2C3230', // line-strong
    divider: '#1F2321', // line-subtle
    textSecondary: '#ABB3AE', // text-2
    hint: '#8C9590', // text-muted
    warning: '#E3B66B', // warn
    success: '#7EDDB0', // accent
    raised: '#181B1A', // bg-raised
  },
};

export const THEME_OPTIONS: { id: ThemePreferenceId; label: string; description: string }[] = [
  { id: 'simple', label: 'Simple', description: "KitchenOS's original look." },
  { id: 'dark-neon', label: 'Graphite Mint', description: 'A dark graphite theme with a mint highlight.' },
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
