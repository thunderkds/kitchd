import { describe, expect, it } from 'vitest';
import { apiThemeToId, idToApiTheme, DEFAULT_THEME } from './themeMapping';

describe('themeMapping (T026 — casing boundary + fallback)', () => {
  it('translates the backend simple enum value to the frontend id', () => {
    expect(apiThemeToId('simple')).toBe('simple');
  });

  it('translates the backend dark_neon enum value (snake_case) to the frontend dark-neon id (kebab-case)', () => {
    expect(apiThemeToId('dark_neon')).toBe('dark-neon');
  });

  it('AC6: falls back to "simple" for a null themePreference (never set)', () => {
    expect(apiThemeToId(null)).toBe(DEFAULT_THEME);
  });

  it('AC6: falls back to "simple" for an undefined themePreference', () => {
    expect(apiThemeToId(undefined)).toBe(DEFAULT_THEME);
  });

  it('AC6: falls back to "simple" for an unrecognized/invalid theme string, does not crash', () => {
    expect(apiThemeToId('midnight-mode')).toBe(DEFAULT_THEME);
  });

  it('translates the frontend simple id back to the backend enum value', () => {
    expect(idToApiTheme('simple')).toBe('simple');
  });

  it('translates the frontend dark-neon id (kebab-case) back to the backend dark_neon enum value (snake_case)', () => {
    expect(idToApiTheme('dark-neon')).toBe('dark_neon');
  });
});
