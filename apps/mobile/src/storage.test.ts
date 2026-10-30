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
    expect(warnSpy).toHaveBeenCalledWith('Failed to parse native session storage', expect.any(String))
  })

  // M013 AC3: V8 quotes short, non-object-looking input in its SyntaxError message, so the blob
  // (which holds the token) must never reach the log, as an error object or inside its message.
  it('never logs the raw stored blob when parsing fails (M013 AC3)', async () => {
    mockSecureStore.data.set('session', 'secret-token-abc')
    const { sessionReady } = loadStorageModule()
    await sessionReady

    const logged = JSON.stringify(warnSpy.mock.calls.flat().map((arg) => (arg instanceof Error ? [arg.name, arg.message] : arg)))
    expect(logged).not.toContain('secret-token-abc')
    warnSpy.mock.calls.flat().forEach((arg) => expect(arg).not.toBeInstanceOf(Error))
  })

  it('reads the token/user keys from @kitchenos/shared instead of redefining them (M013 AC4)', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    let loaded!: typeof import('./storage')
    jest.isolateModules(() => {
      jest.doMock('@kitchenos/shared', () => ({
        ...jest.requireActual('@kitchenos/shared'),
        ACCESS_TOKEN_STORAGE_KEY: 'sharedAccessKey',
        AUTH_USER_STORAGE_KEY: 'sharedUserKey',
      }))
      try {
        loaded = require('./storage')
      } finally {
        jest.dontMock('@kitchenos/shared')
      }
    })
    await loaded.sessionReady

    const storage = loaded.createSessionStorage()
    expect(storage.getItem('sharedAccessKey')).toBe('token-123')
    expect(storage.getItem('sharedUserKey')).toBe(userJson)
    expect(storage.getItem('accessToken')).toBeNull()
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

describe('native session storage: logout durability (M013)', () => {
  const rejectDeleteFor = (...keys: string[]) => {
    const real = mockSecureStore.deleteItemAsync.getMockImplementation()!
    mockSecureStore.deleteItemAsync.mockImplementation(async (key: string) => {
      if (keys.includes(key)) throw new Error(`cannot delete ${key}`)
      return real(key)
    })
  }

  it('AC1: deletes the legacy keys before the session key', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    mockSecureStore.data.set('accessToken', 'stale')
    mockSecureStore.data.set('authUser', 'stale')
    const { clearSession, sessionReady } = loadStorageModule()
    await sessionReady

    await clearSession()

    const deleted = mockSecureStore.deleteItemAsync.mock.calls.map(([key]: [string]) => key)
    expect(deleted.indexOf('session')).toBe(deleted.length - 1)
    expect(deleted).toEqual(expect.arrayContaining(['accessToken', 'authUser']))
  })

  it('AC1: a failed legacy delete does not let the next hydration restore a token', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    mockSecureStore.data.set('accessToken', 'legacy-token')
    const first = loadStorageModule()
    await first.sessionReady
    rejectDeleteFor('accessToken')

    await first.clearSession()

    const second = loadStorageModule()
    await second.sessionReady
    expect(second.createSessionStorage().getItem('accessToken')).toBeNull()
    expect(second.createSessionStorage().getItem('authUser')).toBeNull()
  })

  it('AC2: a failed session delete falls back to writing the empty state', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    const first = loadStorageModule()
    await first.sessionReady
    const listener = jest.fn()
    first.onSessionChange(listener)
    rejectDeleteFor('session')

    await expect(first.clearSession()).resolves.toBeUndefined()

    expect(mockSecureStore.data.get('session')).toBe(blob(null, null))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(first.createSessionStorage().getItem('accessToken')).toBeNull()
    const second = loadStorageModule()
    await second.sessionReady
    expect(second.createSessionStorage().getItem('accessToken')).toBeNull()
  })

  it('AC2: when the empty-state write also fails, clearSession still resolves with memory cleared and warns message-only', async () => {
    mockSecureStore.data.set('session', blob('token-123', userJson))
    const { clearSession, createSessionStorage, sessionReady } = loadStorageModule()
    await sessionReady
    rejectDeleteFor('session')
    mockSecureStore.setItemAsync.mockRejectedValue(new Error('disk full'))

    await expect(clearSession()).resolves.toBeUndefined()

    expect(createSessionStorage().getItem('accessToken')).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith('Failed to clear native session storage', 'disk full')
    warnSpy.mock.calls.flat().forEach((arg) => expect(arg).not.toBeInstanceOf(Error))
  })

  // M021: a login that lands while clearSession still awaits its deletes owns the stored blob.
  describe('a login landing mid-logout (M021)', () => {
    // Holds only clearSession's two legacy deletes (the next two calls); later calls pass through.
    function holdNextLegacyDeletes() {
      const real = mockSecureStore.deleteItemAsync.getMockImplementation()!
      let release!: () => void
      const gate = new Promise<void>((resolve) => (release = resolve))
      mockSecureStore.deleteItemAsync.mockImplementationOnce(async (key: string) => {
        await gate
        return real(key)
      })
      mockSecureStore.deleteItemAsync.mockImplementationOnce(async (key: string) => {
        await gate
        return real(key)
      })
      return () => release()
    }

    it('AC1: persistSession completing while clearSession awaits its deletes keeps the new session', async () => {
      mockSecureStore.data.set('session', blob('old-token', userJson))
      const first = loadStorageModule()
      await first.sessionReady
      const release = holdNextLegacyDeletes()

      const clearing = first.clearSession()
      await flush()
      await first.persistSession('new-token', JSON.parse(userJson))
      release()
      await clearing

      expect(mockSecureStore.data.get('session')).toBe(blob('new-token', userJson))
      expect(first.createSessionStorage().getItem('accessToken')).toBe('new-token')
      const second = loadStorageModule()
      await second.sessionReady
      expect(second.createSessionStorage().getItem('accessToken')).toBe('new-token')
    })

    it('AC1: when a legacy delete fails and a login landed, the new session is not overwritten with the empty blob', async () => {
      mockSecureStore.data.set('session', blob('old-token', userJson))
      mockSecureStore.data.set('accessToken', 'legacy-token')
      const first = loadStorageModule()
      await first.sessionReady
      const real = mockSecureStore.deleteItemAsync.getMockImplementation()!
      let release!: () => void
      const gate = new Promise<void>((resolve) => (release = resolve))
      mockSecureStore.deleteItemAsync.mockImplementationOnce(async () => {
        await gate
        throw new Error('cannot delete accessToken')
      })
      mockSecureStore.deleteItemAsync.mockImplementationOnce(async (key: string) => {
        await gate
        return real(key)
      })

      const clearing = first.clearSession()
      await flush()
      await first.persistSession('new-token', JSON.parse(userJson))
      release()
      await expect(clearing).resolves.toBeUndefined()

      expect(mockSecureStore.data.get('session')).toBe(blob('new-token', userJson))
    })
  })
})

describe('native session storage: write racing the cold-start hydration', () => {
  // storage.ts hydration assigns `nativeSessionState = {...}` from the stored blob when the read
  // resolves, clobbering anything persistSession wrote while the read was still in flight.
  it('persistSession before hydration finishes is not overwritten by the older stored session', async () => {
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

  // No `session` blob, only legacy keys, so hydration reaches the second (legacy) read.
  function holdLegacyReads() {
    const readAtCallTime = mockSecureStore.getItemAsync.getMockImplementation()!
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
      const value = readAtCallTime(key) // value as of call time
      if (key === 'accessToken' || key === 'authUser') {
        await gate
      }
      return value
    })
    return () => release()
  }

  it('persistSession during the legacy-key read is not overwritten by the legacy state', async () => {
    mockSecureStore.data.set('accessToken', 'legacy-token')
    mockSecureStore.data.set('authUser', userJson)
    const release = holdLegacyReads()
    const { createSessionStorage, persistSession, sessionReady } = loadStorageModule()
    await flush() // hydration has passed the blob read and is waiting on the legacy keys

    await persistSession('new-token', JSON.parse(userJson))
    release()
    await sessionReady

    expect(createSessionStorage().getItem('accessToken')).toBe('new-token')
    expect(mockSecureStore.data.get('session')).toBe(blob('new-token', userJson))
  })

  it('clearSession during the legacy-key read does not resurrect the legacy state', async () => {
    mockSecureStore.data.set('accessToken', 'legacy-token')
    mockSecureStore.data.set('authUser', userJson)
    const release = holdLegacyReads()
    const { createSessionStorage, clearSession, sessionReady } = loadStorageModule()
    await flush()

    await clearSession()
    release()
    await sessionReady

    expect(createSessionStorage().getItem('accessToken')).toBeNull()
    expect(createSessionStorage().getItem('authUser')).toBeNull()
    expect(mockSecureStore.data.has('session')).toBe(false)
  })

  function holdFirstRead() {
    const readAtCallTime = mockSecureStore.getItemAsync.getMockImplementation()!
    let release!: () => void
    mockSecureStore.getItemAsync.mockImplementationOnce((key: string) => {
      const staleValue = readAtCallTime(key)
      return new Promise((resolve) => {
        release = () => resolve(staleValue)
      })
    })
    return () => release()
  }

  it('clearSession before hydration finishes is not undone by the older stored session', async () => {
    mockSecureStore.data.set('session', blob('old-token', userJson))
    const release = holdFirstRead()
    const { createSessionStorage, clearSession, sessionReady } = loadStorageModule()

    await clearSession()
    release()
    await sessionReady

    expect(createSessionStorage().getItem('accessToken')).toBeNull()
  })

  it('an adapter setItem before hydration finishes is not overwritten by the older stored session', async () => {
    mockSecureStore.data.set('session', blob('old-token', userJson))
    const release = holdFirstRead()
    const { createSessionStorage, sessionReady } = loadStorageModule()

    createSessionStorage().setItem('accessToken', 'new-token')
    release()
    await sessionReady

    expect(createSessionStorage().getItem('accessToken')).toBe('new-token')
  })
})

describe('session change listeners (M009)', () => {
  const user = JSON.parse(userJson)

  it('clearSession resolves, still runs later listeners and clears the token when a listener throws', async () => {
    const { clearSession, createSessionStorage, onSessionChange, persistSession, sessionReady } = loadStorageModule()
    await sessionReady
    await persistSession('token-a', user)
    const thrower = jest.fn(() => {
      throw new Error('listener boom')
    })
    const second = jest.fn()
    onSessionChange(thrower)
    onSessionChange(second)
    thrower.mockClear()

    await expect(clearSession()).resolves.toBeUndefined()

    expect(thrower).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(createSessionStorage().getItem('accessToken')).toBeNull()
    expect(mockSecureStore.data.has('session')).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith('Session change listener failed', 'listener boom')
  })

  it('persistSession resolves, still runs later listeners and stores the token when a listener throws', async () => {
    const { createSessionStorage, onSessionChange, persistSession, sessionReady } = loadStorageModule()
    await sessionReady
    const thrower = jest.fn(() => {
      throw new Error('listener boom')
    })
    const second = jest.fn()
    onSessionChange(thrower)
    onSessionChange(second)

    await expect(persistSession('token-b', user)).resolves.toBeUndefined()

    expect(thrower).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(createSessionStorage().getItem('accessToken')).toBe('token-b')
    expect(mockSecureStore.data.get('session')).toBe(blob('token-b', JSON.stringify(user)))
  })
})
