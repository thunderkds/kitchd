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

import { DEFAULT_THEME, PALETTES, createThemeStore, resolvePalette, toApiTheme } from './theme'

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
    expect(PALETTES.simple.background).not.toBe(PALETTES['dark-neon'].background)
  })

  it('falls back to the default palette for a missing or unknown preference', () => {
    expect(DEFAULT_THEME).toBe('simple')
    expect(resolvePalette(undefined)).toBe(PALETTES.simple)
    expect(resolvePalette(null)).toBe(PALETTES.simple)
    expect(resolvePalette('sepia')).toBe(PALETTES.simple)
  })

  it('gives every palette the six colour roles', () => {
    for (const palette of Object.values(PALETTES)) {
      expect(Object.keys(palette).sort()).toEqual(
        ['accent', 'background', 'border', 'danger', 'muted', 'surface', 'text'].sort(),
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
