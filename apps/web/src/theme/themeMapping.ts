/**
 * T026 — casing boundary between the frontend and backend theme
 * representations (Edge Case Checklist: "casing mismatch between frontend
 * theme IDs and backend enum values").
 *
 * Frontend `ThemeId` is kebab-case, matching the `[data-theme="..."]` CSS
 * attribute-selector syntax directly (ADR-0001 §3). The backend's Prisma
 * `Theme` enum is snake_case (`simple` / `dark_neon`, see
 * apps/api/prisma/schema.prisma). Every value crossing the API boundary
 * (auth payload in, PATCH body out) must go through the helpers below —
 * never leak one casing convention into the other's context.
 */

export type ThemeId = 'simple' | 'dark-neon';

export const DEFAULT_THEME: ThemeId = 'simple';

export type ApiTheme = 'simple' | 'dark_neon';

const API_TO_ID: Record<string, ThemeId> = {
  simple: 'simple',
  dark_neon: 'dark-neon',
};

const ID_TO_API: Record<ThemeId, ApiTheme> = {
  simple: 'simple',
  'dark-neon': 'dark_neon',
};

/**
 * Translates the backend's `Theme` enum value (snake_case) into the
 * frontend's `ThemeId` (kebab-case). Falls back to `"simple"` for a
 * null/undefined value (a user who never set a preference) and for any
 * unrecognized string (e.g. a theme value from a future backend rollout
 * this build doesn't know about yet) — the UI must never render unstyled
 * (Edge Case Checklist, Acceptance Criterion 6).
 */
export function apiThemeToId(value: string | null | undefined): ThemeId {
  if (!value) return DEFAULT_THEME;
  return API_TO_ID[value] ?? DEFAULT_THEME;
}

/** Translates a frontend `ThemeId` into the backend's snake_case enum value. */
export function idToApiTheme(id: ThemeId): ApiTheme {
  return ID_TO_API[id] ?? ID_TO_API[DEFAULT_THEME];
}
