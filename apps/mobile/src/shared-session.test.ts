import { createSessionStore, type StoredUser } from '@kitchenos/shared'

function createMemoryStorage() {
  const values = new Map<string, string>()

  return {
    values,
    getItem(key: string) {
      return values.has(key) ? values.get(key) ?? null : null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
    removeItem(key: string) {
      values.delete(key)
    },
  }
}

const user: StoredUser = {
  id: 'user-1',
  email: 'chef@example.com',
  organizationId: 'org-1',
  kitchenId: 'kitchen-1',
  role: 'CHEF',
  themePreference: 'dark-neon',
}

describe('createSessionStore', () => {
  it('sets and gets the token', () => {
    const session = createSessionStore(createMemoryStorage())

    session.setToken('token-123')

    expect(session.getToken()).toBe('token-123')
    expect(session.isAuthenticated()).toBe(true)
  })

  it('reports no token and unauthenticated on an empty store', () => {
    const session = createSessionStore(createMemoryStorage())

    expect(session.getToken()).toBeNull()
    expect(session.isAuthenticated()).toBe(false)
  })

  it('clears the token and leaves the user', () => {
    const session = createSessionStore(createMemoryStorage())
    session.setToken('token-123')
    session.setUser(user)

    session.clearToken()

    expect(session.getToken()).toBeNull()
    expect(session.isAuthenticated()).toBe(false)
    expect(session.getUser()).toEqual(user)
  })

  it('treats an empty-string token as unauthenticated', () => {
    const session = createSessionStore(createMemoryStorage())

    session.setToken('')

    expect(session.isAuthenticated()).toBe(false)
  })

  it('sets and gets the user as a round-tripped object', () => {
    const session = createSessionStore(createMemoryStorage())

    session.setUser(user)

    expect(session.getUser()).toEqual(user)
  })

  it('serialises the user as JSON under the authUser key', () => {
    const storage = createMemoryStorage()
    const session = createSessionStore(storage)

    session.setUser(user)

    expect(JSON.parse(storage.values.get('authUser') ?? '')).toEqual(user)
  })

  it('stores the token under the accessToken key', () => {
    const storage = createMemoryStorage()
    const session = createSessionStore(storage)

    session.setToken('token-123')

    expect(storage.values.get('accessToken')).toBe('token-123')
  })

  it('clears the user and leaves the token', () => {
    const session = createSessionStore(createMemoryStorage())
    session.setToken('token-123')
    session.setUser(user)

    session.clearUser()

    expect(session.getUser()).toBeNull()
    expect(session.getToken()).toBe('token-123')
  })

  it('returns null when no user is stored', () => {
    const session = createSessionStore(createMemoryStorage())

    expect(session.getUser()).toBeNull()
  })

  it('returns null for a malformed JSON user payload', () => {
    const storage = createMemoryStorage()
    const session = createSessionStore(storage)

    storage.setItem('authUser', '{not-json')

    expect(session.getUser()).toBeNull()
  })

  it('returns null for an empty-string user payload', () => {
    const storage = createMemoryStorage()
    const session = createSessionStore(storage)

    storage.setItem('authUser', '')

    expect(session.getUser()).toBeNull()
  })
})
