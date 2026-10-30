import type { StoredUser } from '@kitchenos/shared'

let mockUser: StoredUser | null = null
const mockSetUser = jest.fn((user: StoredUser) => {
  mockUser = user
})
jest.mock('./session', () => ({
  session: {
    getUser: () => mockUser,
    setUser: (user: StoredUser) => mockSetUser(user),
  },
}))

import { DEFAULT_THEME, PALETTES, THEME_OPTIONS, createThemeStore, resolvePalette, toApiTheme } from './theme'

const chef: StoredUser = {
  id: 'u1',
  email: 'chef@example.com',
  organizationId: 'org-1',
  kitchenId: 'k1',
  role: 'CHEF',
}

beforeEach(() => {
  mockUser = null
  mockSetUser.mockClear()
})

describe('theme mapping (M006 AC3)', () => {
  it('maps each stored preference to its own palette', () => {
    expect(resolvePalette('simple')).toBe(PALETTES.simple)
    expect(resolvePalette('dark-neon')).toBe(PALETTES['dark-neon'])
  })

  it('simple is exactly the look the screens hard-coded before M006 (no visual change for default users)', () => {
    expect(PALETTES.simple).toEqual({
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
    })
  })

  it('dark-neon holds the Graphite Mint tokens (M022 AC1)', () => {
    expect(PALETTES['dark-neon']).toEqual({
      background: '#121413',
      surface: '#181B1A',
      text: '#DCE0DD',
      muted: '#8C9590',
      accent: '#3CF5A8',
      accentSoft: '#7EDDB0',
      danger: '#E8968F',
      border: '#262B29',
      onAccent: '#0E100F',
      inputBackground: '#0E100F',
      inputBorder: '#2C3230',
      divider: '#1F2321',
      textSecondary: '#ABB3AE',
      hint: '#8C9590',
      warning: '#E3B66B',
      success: '#7EDDB0',
      raised: '#181B1A',
    })
  })

  it('labels the dark-neon option "Graphite Mint" but keeps its id (M022 AC3)', () => {
    const option = THEME_OPTIONS.find((o) => o.id === 'dark-neon')
    expect(option?.label).toBe('Graphite Mint')
    expect(option?.description).toBe('A dark graphite theme with a mint highlight.')
    expect(THEME_OPTIONS.map((o) => o.id)).toEqual(['simple', 'dark-neon'])
  })

  it('falls back to the default palette for a missing or unknown preference', () => {
    expect(DEFAULT_THEME).toBe('simple')
    expect(resolvePalette(undefined)).toBe(PALETTES.simple)
    expect(resolvePalette(null)).toBe(PALETTES.simple)
    expect(resolvePalette('sepia')).toBe(PALETTES.simple)
  })

  it('gives every palette the same colour roles', () => {
    for (const palette of Object.values(PALETTES)) {
      expect(Object.keys(palette).sort()).toEqual(
        [
          'accent', 'accentSoft', 'background', 'border', 'danger', 'muted', 'onAccent', 'surface', 'text',
          'inputBackground', 'inputBorder', 'divider', 'textSecondary', 'hint', 'warning', 'success', 'raised',
        ].sort(),
      )
    }
  })

  it('converts a preference to the API enum value (dark-neon -> dark_neon, accepted by update-theme.dto.ts)', () => {
    expect(toApiTheme('simple')).toBe('simple')
    expect(toApiTheme('dark-neon')).toBe('dark_neon')
  })
})

describe('theme store', () => {
  it('reads the preference from the stored user, defaulting to simple', () => {
    const store = createThemeStore()
    expect(store.getPreference()).toBe('simple')

    mockUser = { ...chef, themePreference: 'dark-neon' }
    expect(store.getPreference()).toBe('dark-neon')
  })

  it('writes the preference into the stored user and notifies subscribers', () => {
    mockUser = { ...chef, themePreference: 'simple' }
    const store = createThemeStore()
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)

    store.setPreference('dark-neon')

    expect(mockSetUser).toHaveBeenCalledWith({ ...chef, themePreference: 'dark-neon' })
    expect(store.getPreference()).toBe('dark-neon')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    store.setPreference('simple')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not write when nobody is signed in', () => {
    const store = createThemeStore()
    store.setPreference('dark-neon')
    expect(mockSetUser).not.toHaveBeenCalled()
  })
})
