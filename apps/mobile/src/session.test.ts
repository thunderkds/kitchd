const mockSecureStore = require('./testing/memorySecureStore').createMemorySecureStore() as ReturnType<
  typeof import('./testing/memorySecureStore').createMemorySecureStore
>

jest.mock('expo-secure-store', () => mockSecureStore)
jest.mock('react-native', () => ({
  // storage.ts imports queryClient, which subscribes to AppState for focus refetching.
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
  Platform: {
    OS: 'ios',
  },
}))

import type { StoredUser } from '@kitchenos/shared'

const chef: StoredUser = {
  id: 'user-1',
  email: 'chef@example.com',
  organizationId: 'org-1',
  kitchenId: 'kitchen-1',
  role: 'CHEF',
  themePreference: 'dark-neon',
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

function loadModules() {
  let session!: typeof import('./session')
  let storage!: typeof import('./storage')
  jest.isolateModules(() => {
    storage = require('./storage')
    session = require('./session')
  })
  return { ...session, ...storage }
}

beforeEach(() => {
  mockSecureStore.reset()
})

describe('toStoredUser', () => {
  it('keeps only supported theme preferences', () => {
    const { toStoredUser } = loadModules()

    expect(
      toStoredUser({
        id: 'user-1',
        email: 'chef@example.com',
        organizationId: 'org-1',
        kitchenId: 'kitchen-1',
        role: 'CHEF',
        themePreference: 'dark-neon',
      }),
    ).toEqual(chef)
  })

  it('accepts the API snake_case value (dark_neon) as dark-neon (M006: the API sends the Prisma enum)', () => {
    const { toStoredUser } = loadModules()

    expect(
      toStoredUser({
        id: 'user-1',
        email: 'chef@example.com',
        organizationId: 'org-1',
        kitchenId: 'kitchen-1',
        role: 'CHEF',
        themePreference: 'dark_neon',
      }),
    ).toEqual(chef)
  })

  it('drops unsupported theme preferences', () => {
    const { toStoredUser } = loadModules()

    expect(
      toStoredUser({
        id: 'user-2',
        email: 'staff@example.com',
        organizationId: 'org-1',
        kitchenId: 'kitchen-1',
        role: 'STAFF',
        themePreference: 'sepia',
      }),
    ).toEqual({
      id: 'user-2',
      email: 'staff@example.com',
      organizationId: 'org-1',
      kitchenId: 'kitchen-1',
      role: 'STAFF',
    })
  })

  it('drops a null theme preference', () => {
    const { toStoredUser } = loadModules()

    expect(
      toStoredUser({
        id: 'user-3',
        email: 'owner@example.com',
        organizationId: 'org-1',
        kitchenId: 'kitchen-1',
        role: 'OWNER',
        themePreference: null,
      }),
    ).not.toHaveProperty('themePreference')
  })
})

describe('session (native storage-backed)', () => {
  it('sets and gets the token', async () => {
    const { session, sessionReady } = loadModules()
    await sessionReady

    session.setToken('token-123')

    expect(session.getToken()).toBe('token-123')
    expect(session.isAuthenticated()).toBe(true)
  })

  it('sets and gets the user', async () => {
    const { session, sessionReady } = loadModules()
    await sessionReady

    session.setUser(chef)

    expect(session.getUser()).toEqual(chef)
  })

  it('clears the token without clearing the user', async () => {
    const { session, sessionReady } = loadModules()
    await sessionReady
    session.setToken('token-123')
    session.setUser(chef)

    session.clearToken()

    expect(session.getToken()).toBeNull()
    expect(session.isAuthenticated()).toBe(false)
    expect(session.getUser()).toEqual(chef)
  })

  it('clears the user without clearing the token', async () => {
    const { session, sessionReady } = loadModules()
    await sessionReady
    session.setToken('token-123')
    session.setUser(chef)

    session.clearUser()

    expect(session.getUser()).toBeNull()
    expect(session.getToken()).toBe('token-123')
  })

  it('persists token and user so a cold start restores them', async () => {
    const first = loadModules()
    await first.sessionReady
    first.session.setToken('token-123')
    first.session.setUser(chef)
    await flush()

    const second = loadModules()
    await second.sessionReady

    expect(second.session.getToken()).toBe('token-123')
    expect(second.session.getUser()).toEqual(chef)
  })

  it('cold start before hydration reads as signed out', () => {
    mockSecureStore.data.set('session', JSON.stringify({ accessToken: 'token-123', authUser: JSON.stringify(chef) }))
    mockSecureStore.getItemAsync.mockImplementation(() => new Promise<string | null>(() => undefined))

    const { session } = loadModules()

    expect(session.getToken()).toBeNull()
    expect(session.isAuthenticated()).toBe(false)
    expect(session.getUser()).toBeNull()
  })

  it('cold start after sessionReady resolves reads the stored session', async () => {
    mockSecureStore.data.set('session', JSON.stringify({ accessToken: 'token-123', authUser: JSON.stringify(chef) }))

    const { session, sessionReady } = loadModules()
    expect(session.getToken()).toBeNull()

    await sessionReady

    expect(session.getToken()).toBe('token-123')
    expect(session.isAuthenticated()).toBe(true)
    expect(session.getUser()).toEqual(chef)
  })

  it('cold start after sessionReady with nothing stored stays signed out', async () => {
    const { session, sessionReady } = loadModules()

    await sessionReady

    expect(session.isAuthenticated()).toBe(false)
    expect(session.getUser()).toBeNull()
  })

  it('sessionReady resolves only once the secure store read has completed', async () => {
    let release!: (value: string | null) => void
    mockSecureStore.getItemAsync.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => (release = resolve)),
    )
    const { sessionReady } = loadModules()
    let settled = false
    void sessionReady.then(() => {
      settled = true
    })

    await flush()
    expect(settled).toBe(false)

    release(null)
    await sessionReady
    expect(settled).toBe(true)
  })

  it('a stored user that is not valid JSON reads as null while the token still works', async () => {
    mockSecureStore.data.set('session', JSON.stringify({ accessToken: 'token-123', authUser: '{not-json' }))
    const { session, sessionReady } = loadModules()
    await sessionReady

    expect(session.getToken()).toBe('token-123')
    expect(session.getUser()).toBeNull()
  })
})
