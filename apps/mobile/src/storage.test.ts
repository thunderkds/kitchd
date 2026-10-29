const mockSecureStore = require('./testing/memorySecureStore').createMemorySecureStore() as ReturnType<
  typeof import('./testing/memorySecureStore').createMemorySecureStore
>

jest.mock('expo-secure-store', () => mockSecureStore)
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}))

const userJson = JSON.stringify({
  id: 'user-1',
  email: 'chef@example.com',
  organizationId: 'org-1',
  kitchenId: 'kitchen-1',
  role: 'CHEF',
})

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

function loadStorageModule() {
  let loaded!: typeof import('./storage')
  jest.isolateModules(() => {
    loaded = require('./storage')
  })
  return loaded
}

function blob(accessToken: string | null, authUser: string | null) {
  return JSON.stringify({ accessToken, authUser })
}

let warnSpy: jest.SpyInstance

beforeEach(() => {
  mockSecureStore.reset()
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  warnSpy.mockRestore()
})

describe('native session storage: secure-store write + read', () => {
  it('writes the token and user as one combined "session" entry', async () => {
    const { persistSession, sessionReady } = loadStorageModule()
    await sessionReady

    await persistSession('token-456', JSON.parse(userJson))

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(1)
    expect(mockSecureStore.data.get('session')).toBe(blob('token-456', userJson))
  })

  it('reads a persisted session back after a cold start', async () => {
    const first = loadStorageModule()
    await first.sessionReady
    await first.persistSession('token-456', JSON.parse(userJson))

    const second = loadStorageModule()
    await second.sessionReady
    const storage = second.createSessionStorage()

    expect(storage.getItem('accessToken')).toBe('token-456')
    expect(storage.getItem('authUser')).toBe(userJson)
  })

  it('returns null for an unknown key', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady

    expect(createSessionStorage().getItem('somethingElse')).toBeNull()
  })

  it('treats non-string fields in a stored blob as null', async () => {
    mockSecureStore.data.set('session', JSON.stringify({ accessToken: 42, authUser: { id: 'x' } }))
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady

    const storage = createSessionStorage()
    expect(storage.getItem('accessToken')).toBeNull()
    expect(storage.getItem('authUser')).toBeNull()
  })

  it('falls back to an empty session and warns when the stored blob is not JSON', async () => {
    mockSecureStore.data.set('session', '{not-json')
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady

    const storage = createSessionStorage()
    expect(storage.getItem('accessToken')).toBeNull()
    expect(storage.getItem('authUser')).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith('Failed to parse native session storage', expect.any(SyntaxError))
  })

  it('resolves sessionReady with an empty session and warns when the secure store read rejects', async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(new Error('keychain locked'))
    const { createSessionStorage, sessionReady } = loadStorageModule()

    await expect(sessionReady).resolves.toBeUndefined()
    expect(createSessionStorage().getItem('accessToken')).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith('Failed to hydrate native session storage', expect.any(Error))
  })
})

describe('native session storage: in-memory cache', () => {
  it('hydrates from secure store only once, however many adapters are created', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady

    createSessionStorage()
    createSessionStorage()
    await flush()

    expect(mockSecureStore.getItemAsync.mock.calls.filter(([key]) => key === 'session')).toHaveLength(1)
  })

  it('serves reads from the cache without touching secure store', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady
    const storage = createSessionStorage()
    mockSecureStore.getItemAsync.mockClear()

    expect(storage.getItem('accessToken')).toBe('token-123')
    expect(storage.getItem('accessToken')).toBe('token-123')
    expect(storage.getItem('authUser')).toBe(userJson)

    expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled()
  })

  it('setItem updates the cache synchronously, before the secure store write settles', async () => {
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady
    const storage = createSessionStorage()
    mockSecureStore.setItemAsync.mockImplementation(() => new Promise<void>(() => undefined))

    storage.setItem('accessToken', 'token-new')

    expect(storage.getItem('accessToken')).toBe('token-new')
  })

  it('setItem persists the whole combined blob', async () => {
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady
    const storage = createSessionStorage()

    storage.setItem('accessToken', 'token-new')
    storage.setItem('authUser', userJson)
    await flush()

    expect(mockSecureStore.data.get('session')).toBe(blob('token-new', userJson))
  })

  it('removeItem clears only that key in the cache and the persisted blob', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady
    const storage = createSessionStorage()

    storage.removeItem('accessToken')
    await flush()

    expect(storage.getItem('accessToken')).toBeNull()
    expect(storage.getItem('authUser')).toBe(userJson)
    expect(mockSecureStore.data.get('session')).toBe(blob(null, userJson))
  })

  it('ignores writes to unknown keys', async () => {
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady
    const storage = createSessionStorage()

    storage.setItem('somethingElse', 'x')

    expect(storage.getItem('somethingElse')).toBeNull()
  })
})

describe('native session storage: legacy key migration (f95e26a)', () => {
  it('migrates legacy accessToken + authUser keys into the combined blob and deletes them', async () => {
    mockSecureStore.data.set('accessToken', 'legacy-token')
    mockSecureStore.data.set('authUser', userJson)
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady

    const storage = createSessionStorage()
    expect(storage.getItem('accessToken')).toBe('legacy-token')
    expect(storage.getItem('authUser')).toBe(userJson)
    expect(mockSecureStore.data.get('session')).toBe(blob('legacy-token', userJson))
    expect(mockSecureStore.data.has('accessToken')).toBe(false)
    expect(mockSecureStore.data.has('authUser')).toBe(false)
  })

  it('migrates when only one legacy key exists', async () => {
    mockSecureStore.data.set('accessToken', 'legacy-token')
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady

    const storage = createSessionStorage()
    expect(storage.getItem('accessToken')).toBe('legacy-token')
    expect(storage.getItem('authUser')).toBeNull()
    expect(mockSecureStore.data.get('session')).toBe(blob('legacy-token', null))
    expect(mockSecureStore.data.has('accessToken')).toBe(false)
  })

  it('writes the combined blob before deleting the legacy keys', async () => {
    mockSecureStore.data.set('accessToken', 'legacy-token')
    mockSecureStore.data.set('authUser', userJson)
    const { sessionReady } = loadStorageModule()
    await sessionReady

    const setOrder = mockSecureStore.setItemAsync.mock.invocationCallOrder[0]
    const deleteOrders = mockSecureStore.deleteItemAsync.mock.invocationCallOrder
    expect(deleteOrders).toHaveLength(2)
    deleteOrders.forEach((order: number) => expect(order).toBeGreaterThan(setOrder))
  })

  it('keeps the legacy keys when writing the combined blob fails, so nothing is lost', async () => {
    mockSecureStore.data.set('accessToken', 'legacy-token')
    mockSecureStore.data.set('authUser', userJson)
    mockSecureStore.setItemAsync.mockRejectedValue(new Error('disk full'))
    const { sessionReady } = loadStorageModule()
    await sessionReady

    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled()
    expect(mockSecureStore.data.get('accessToken')).toBe('legacy-token')
    expect(mockSecureStore.data.get('authUser')).toBe(userJson)
  })

  it('prefers the combined blob and leaves legacy keys untouched when both exist', async () => {
    mockSecureStore.data.set('session', blob('new-token', userJson))
    mockSecureStore.data.set('accessToken', 'legacy-token')
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady

    expect(createSessionStorage().getItem('accessToken')).toBe('new-token')
    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled()
    expect(mockSecureStore.data.get('accessToken')).toBe('legacy-token')
  })

  it('stays empty and writes nothing on a fresh install', async () => {
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady

    const storage = createSessionStorage()
    expect(storage.getItem('accessToken')).toBeNull()
    expect(storage.getItem('authUser')).toBeNull()
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled()
  })
})

describe('native session storage: atomic write + failure path (80a0bcf)', () => {
  it('persistSession writes token and user in a single secure store call', async () => {
    const { persistSession, sessionReady } = loadStorageModule()
    await sessionReady

    await persistSession('token-456', JSON.parse(userJson))

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(1)
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('session', blob('token-456', userJson))
  })

  it('persistSession removes stale legacy keys after the blob is written', async () => {
    mockSecureStore.data.set('session', blob('old', userJson))
    mockSecureStore.data.set('accessToken', 'stale')
    mockSecureStore.data.set('authUser', 'stale')
    const { persistSession, sessionReady } = loadStorageModule()
    await sessionReady

    await persistSession('token-456', JSON.parse(userJson))

    expect(mockSecureStore.data.has('accessToken')).toBe(false)
    expect(mockSecureStore.data.has('authUser')).toBe(false)
    const setOrder = mockSecureStore.setItemAsync.mock.invocationCallOrder[0]
    mockSecureStore.deleteItemAsync.mock.invocationCallOrder.forEach((order: number) =>
      expect(order).toBeGreaterThan(setOrder),
    )
  })

  it('persistSession rejects and leaves legacy keys in place when the blob write fails', async () => {
    const { persistSession, sessionReady } = loadStorageModule()
    await sessionReady
    mockSecureStore.data.set('accessToken', 'legacy-token')
    mockSecureStore.setItemAsync.mockRejectedValue(new Error('disk full'))

    await expect(persistSession('token-456', JSON.parse(userJson))).rejects.toThrow('disk full')

    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled()
    expect(mockSecureStore.data.get('accessToken')).toBe('legacy-token')
  })

  it('adapter setItem swallows a failed persist and warns instead of throwing', async () => {
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady
    const storage = createSessionStorage()
    mockSecureStore.setItemAsync.mockRejectedValue(new Error('disk full'))

    expect(() => storage.setItem('accessToken', 'token-new')).not.toThrow()
    await flush()

    expect(warnSpy).toHaveBeenCalledWith('Failed to persist native session storage', expect.any(Error))
  })

  it('adapter removeItem swallows a failed persist and warns instead of throwing', async () => {
    const { createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady
    const storage = createSessionStorage()
    mockSecureStore.setItemAsync.mockRejectedValue(new Error('disk full'))

    expect(() => storage.removeItem('accessToken')).not.toThrow()
    await flush()

    expect(warnSpy).toHaveBeenCalledWith('Failed to persist native session storage', expect.any(Error))
  })

  it('clearSession wipes the cache, the blob, and the legacy keys', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    mockSecureStore.data.set('accessToken', 'stale')
    mockSecureStore.data.set('authUser', 'stale')
    const { clearSession, createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady
    const storage = createSessionStorage()

    await clearSession()

    expect(storage.getItem('accessToken')).toBeNull()
    expect(storage.getItem('authUser')).toBeNull()
    expect(mockSecureStore.data.size).toBe(0)
  })

  it('a cleared session stays cleared after a cold start', async () => {
    const first = loadStorageModule()
    await first.sessionReady
    await first.persistSession('token-456', JSON.parse(userJson))
    await first.clearSession()

    const second = loadStorageModule()
    await second.sessionReady

    expect(second.createSessionStorage().getItem('accessToken')).toBeNull()
  })
})

describe('native session storage: write racing the cold-start hydration', () => {
  // storage.ts hydration assigns `nativeSessionState = {...}` from the stored blob when the read
  // resolves, clobbering anything persistSession wrote while the read was still in flight.
  it.failing('persistSession before hydration finishes is not overwritten by the older stored session', async () => {
    mockSecureStore.data.set('session', blob('old-token', userJson))
    const readAtCallTime = mockSecureStore.getItemAsync.getMockImplementation()!
    let releaseRead!: () => void
    mockSecureStore.getItemAsync.mockImplementationOnce((key: string) => {
      const staleValue = readAtCallTime(key) // the stored value as it was when the read started
      return new Promise((resolve) => {
        releaseRead = () => resolve(staleValue)
      })
    })
    const { createSessionStorage, persistSession, sessionReady } = loadStorageModule()

    await persistSession('new-token', JSON.parse(userJson))
    releaseRead()
    await sessionReady

    expect(createSessionStorage().getItem('accessToken')).toBe('new-token')
  })
})
