export {}

const mockSecureStore = require('./testing/memorySecureStore').createMemorySecureStore() as ReturnType<
  typeof import('./testing/memorySecureStore').createMemorySecureStore
>

type Handler = (payload?: unknown) => void

interface FakeSocket {
  options: { auth?: unknown; [key: string]: unknown }
  url: string
  handlers: Record<string, Handler>
  on: jest.Mock
  off: jest.Mock
  removeAllListeners: jest.Mock
  disconnect: jest.Mock
}

// Every io() call yields a new fake socket, so a test can tell a reused socket from a fresh one.
const mockSockets: FakeSocket[] = []
const mockIo = jest.fn((url: string, options: FakeSocket['options']) => {
  const handlers: Record<string, Handler> = {}
  const socket: FakeSocket = {
    url,
    options,
    handlers,
    on: jest.fn((event: string, cb: Handler) => {
      handlers[event] = cb
    }),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    disconnect: jest.fn(),
  }
  mockSockets.push(socket)
  return socket
})

// jest.mock factories may only reference variables prefixed with `mock`.
const mockAppStateListeners: Array<(state: string) => void> = []
const mockAppState = {
  currentState: 'active',
  addEventListener: jest.fn((_type: string, cb: (state: string) => void) => {
    mockAppStateListeners.push(cb)
    return {
      remove: () => {
        const index = mockAppStateListeners.indexOf(cb)
        if (index >= 0) mockAppStateListeners.splice(index, 1)
      },
    }
  }),
}

jest.mock('socket.io-client', () => ({ io: (...args: unknown[]) => (mockIo as any)(...args) }))
jest.mock('expo-secure-store', () => mockSecureStore)
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('react-native', () => ({
  AppState: mockAppState,
  Platform: { OS: 'ios' },
}))

const user = {
  id: 'user-1',
  email: 'chef@example.com',
  organizationId: 'org-1',
  kitchenId: 'kitchen-1',
  role: 'CHEF' as const,
}

function loadModules() {
  let realtime!: typeof import('./realtime')
  let storage!: typeof import('./storage')
  let api!: typeof import('./api')
  let queryClient!: import('@tanstack/react-query').QueryClient
  jest.isolateModules(() => {
    storage = require('./storage')
    realtime = require('./realtime')
    api = require('./api')
    queryClient = require('./queryClient').queryClient
  })
  return { realtime, storage, api, queryClient }
}

function setAppState(state: string) {
  mockAppState.currentState = state
  for (const listener of [...mockAppStateListeners]) listener(state)
}

function lastSocket(): FakeSocket {
  return mockSockets[mockSockets.length - 1]
}

// The handshake auth is a callback so socket.io re-reads the token on every (re)connection attempt.
function resolveAuth(socket: FakeSocket): Promise<unknown> {
  const auth = socket.options.auth
  if (typeof auth === 'function') {
    return new Promise((resolve) => (auth as (cb: (data: unknown) => void) => void)(resolve))
  }
  return Promise.resolve(auth)
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  mockSecureStore.reset()
  mockSockets.length = 0
  mockAppStateListeners.length = 0
  mockIo.mockClear()
  mockAppState.addEventListener.mockClear()
  mockAppState.currentState = 'active'
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

async function signedIn(token = 'token-a') {
  const modules = loadModules()
  await modules.storage.sessionReady
  await modules.storage.persistSession(token, user)
  // Drop the socket persistSession may have started (before startRealtime is called there is none).
  mockSockets.length = 0
  mockIo.mockClear()
  return modules
}

describe('connect lifecycle (M009 AC1)', () => {
  it('connects with the session JWT in the auth handshake when a token exists', async () => {
    const { realtime } = await signedIn('token-a')

    realtime.startRealtime()

    expect(mockIo).toHaveBeenCalledTimes(1)
    expect(lastSocket().url).toBe('http://localhost:3000')
    await expect(resolveAuth(lastSocket())).resolves.toEqual({ token: 'token-a' })
  })

  it('does not connect when there is no token', async () => {
    const modules = loadModules()
    await modules.storage.sessionReady

    modules.realtime.startRealtime()

    expect(mockIo).not.toHaveBeenCalled()
  })

  it('does not connect while the app is in the background', async () => {
    const { realtime } = await signedIn()
    mockAppState.currentState = 'background'

    realtime.startRealtime()

    expect(mockIo).not.toHaveBeenCalled()
  })

  it('connects after login (persistSession) when started signed out', async () => {
    const modules = loadModules()
    await modules.storage.sessionReady
    modules.realtime.startRealtime()
    expect(mockIo).not.toHaveBeenCalled()

    await modules.storage.persistSession('token-login', user)

    expect(mockIo).toHaveBeenCalledTimes(1)
    await expect(resolveAuth(lastSocket())).resolves.toEqual({ token: 'token-login' })
  })

  it('replaces the socket when a different user logs in, so the old token is not kept', async () => {
    const { realtime, storage } = await signedIn('token-a')
    realtime.startRealtime()
    const first = lastSocket()

    await storage.persistSession('token-b', { ...user, id: 'user-2' })

    expect(first.disconnect).toHaveBeenCalled()
    expect(mockIo).toHaveBeenCalledTimes(2)
    await expect(resolveAuth(lastSocket())).resolves.toEqual({ token: 'token-b' })
  })

  it('reads the token fresh on every handshake, not once at creation', async () => {
    const { realtime, storage } = await signedIn('token-a')
    realtime.startRealtime()
    const socket = lastSocket()

    await storage.persistSession('token-b', user)

    await expect(resolveAuth(socket)).resolves.toEqual({ token: 'token-b' })
  })

  it('startRealtime is idempotent: a second call does not open a second socket', async () => {
    const { realtime } = await signedIn()

    realtime.startRealtime()
    realtime.startRealtime()

    expect(mockIo).toHaveBeenCalledTimes(1)
  })
})

describe('events invalidate the matching queries (M009 AC2)', () => {
  async function started() {
    const modules = await signedIn()
    const spy = jest.spyOn(modules.queryClient, 'invalidateQueries')
    modules.realtime.startRealtime()
    const emit = (event: string) => lastSocket().handlers[event]?.({ eventId: 'e1' })
    const invalidatedKeys = () => spy.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey)
    return { emit, invalidatedKeys }
  }

  it('task.updated invalidates the tasks queries (list and any task detail)', async () => {
    const { emit, invalidatedKeys } = await started()

    emit('task.updated')

    expect(invalidatedKeys()).toEqual([['tasks']])
  })

  it('comment.created invalidates comments and notifications (mentions create notifications)', async () => {
    const { emit, invalidatedKeys } = await started()

    emit('comment.created')

    expect(invalidatedKeys()).toEqual(expect.arrayContaining([['comments'], ['notifications']]))
    expect(invalidatedKeys()).toHaveLength(2)
  })

  it('announcement.created invalidates announcements', async () => {
    const { emit, invalidatedKeys } = await started()

    emit('announcement.created')

    expect(invalidatedKeys()).toEqual([['announcements']])
  })

  it('refetches an active tasks list on task.updated', async () => {
    const { realtime, queryClient } = await signedIn()
    const fetcher = jest.fn().mockResolvedValue([])
    const observer = new (require('@tanstack/react-query').QueryObserver)(queryClient, {
      queryKey: ['tasks', 'list'],
      queryFn: fetcher,
    })
    const unsubscribe = observer.subscribe(() => undefined)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetcher).toHaveBeenCalledTimes(1)
    realtime.startRealtime()

    lastSocket().handlers['task.updated']({ eventId: 'e1', task: { id: 't1' } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetcher).toHaveBeenCalledTimes(2)
    unsubscribe()
    queryClient.clear()
  })
})

describe('AppState and logout (M009 AC3)', () => {
  it('disconnects when the app goes to the background', async () => {
    const { realtime } = await signedIn()
    realtime.startRealtime()
    const socket = lastSocket()

    setAppState('background')

    expect(socket.disconnect).toHaveBeenCalled()
    expect(mockIo).toHaveBeenCalledTimes(1)
  })

  it('keeps the connection on inactive (Control Center, notification shade, app switcher peek)', async () => {
    const { realtime } = await signedIn()
    realtime.startRealtime()
    const socket = lastSocket()

    setAppState('inactive')

    expect(socket.disconnect).not.toHaveBeenCalled()
    expect(socket.removeAllListeners).not.toHaveBeenCalled()
  })

  it('inactive -> active does not open a new socket', async () => {
    const { realtime } = await signedIn()
    realtime.startRealtime()

    setAppState('inactive')
    setAppState('active')

    expect(mockIo).toHaveBeenCalledTimes(1)
  })

  it('inactive -> background still disconnects', async () => {
    const { realtime } = await signedIn()
    realtime.startRealtime()
    const socket = lastSocket()

    setAppState('inactive')
    setAppState('background')

    expect(socket.disconnect).toHaveBeenCalled()
  })

  it('reconnects on active with a new socket and the current token', async () => {
    const { realtime } = await signedIn('token-a')
    realtime.startRealtime()
    setAppState('background')

    setAppState('active')

    expect(mockIo).toHaveBeenCalledTimes(2)
    await expect(resolveAuth(lastSocket())).resolves.toEqual({ token: 'token-a' })
  })

  it('does not stack sockets across repeated active events', async () => {
    const { realtime } = await signedIn()
    realtime.startRealtime()

    setAppState('active')
    setAppState('active')

    expect(mockIo).toHaveBeenCalledTimes(1)
  })

  it('detaches handlers from a socket that was disconnected in the background', async () => {
    const { realtime } = await signedIn()
    realtime.startRealtime()
    const old = lastSocket()

    setAppState('background')

    expect(old.removeAllListeners).toHaveBeenCalled()
  })

  it('does not reconnect on active after logout (no stale token)', async () => {
    const { realtime, storage } = await signedIn('token-a')
    realtime.startRealtime()
    setAppState('background')

    await storage.clearSession()
    setAppState('active')

    expect(mockIo).toHaveBeenCalledTimes(1)
  })

  it('clearSession disconnects the live socket', async () => {
    const { realtime, storage } = await signedIn()
    realtime.startRealtime()
    const socket = lastSocket()

    await storage.clearSession()

    expect(socket.disconnect).toHaveBeenCalled()
    expect(socket.removeAllListeners).toHaveBeenCalled()
  })

  it('clearSession disconnects even when wiping SecureStore rejects', async () => {
    const { realtime, storage } = await signedIn()
    realtime.startRealtime()
    const socket = lastSocket()
    mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('keychain locked'))

    await expect(storage.clearSession()).rejects.toThrow('keychain locked')

    expect(socket.disconnect).toHaveBeenCalled()
  })

  it('the 401 path in request() disconnects the socket', async () => {
    const { realtime, api } = await signedIn()
    realtime.startRealtime()
    const socket = lastSocket()
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })

    await expect(api.listTasks()).rejects.toThrow('Unauthorized')

    expect(socket.disconnect).toHaveBeenCalled()
  })

  it('stop function disconnects and detaches from AppState and session changes', async () => {
    const { realtime, storage } = await signedIn()
    const stop = realtime.startRealtime()
    const socket = lastSocket()

    stop()

    expect(socket.disconnect).toHaveBeenCalled()
    await storage.persistSession('token-b', user)
    setAppState('active')
    expect(mockIo).toHaveBeenCalledTimes(1)
  })
})

describe('catch-up on reconnect (events missed while backgrounded are not replayed)', () => {
  async function started() {
    const modules = await signedIn()
    const spy = jest.spyOn(modules.queryClient, 'invalidateQueries')
    modules.realtime.startRealtime()
    const connected = () => lastSocket().handlers['connect']?.()
    return { ...modules, spy, connected }
  }

  it('does not invalidate on the first connect after start', async () => {
    const { spy, connected } = await started()

    connected()

    expect(spy).not.toHaveBeenCalled()
  })

  it('invalidates everything once on the connect after a background -> active cycle', async () => {
    const { spy, connected } = await started()
    connected()
    setAppState('background')
    setAppState('active')

    connected()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith()
  })

  it('invalidates on a socket.io automatic reconnect (second connect on the same socket)', async () => {
    const { spy, connected } = await started()
    connected()

    connected()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not invalidate on the first connect after login, even after an earlier session connected', async () => {
    const { spy, connected, storage } = await started()
    connected()
    await storage.clearSession()

    await storage.persistSession('token-b', user)
    spy.mockClear()
    connected()

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('recovery from a rejected handshake (connect_error)', () => {
  // The gateway maps any auth failure (bad token, or a DB blip) to connect_error. socket.io does
  // not retry that on its own, so the module must drop the dead socket and let `active` rebuild it.
  const rejectHandshake = () => lastSocket().handlers['connect_error']?.(new Error('Unauthorized'))

  it('cleans up the socket on connect_error', async () => {
    const { realtime } = await signedIn()
    realtime.startRealtime()
    const socket = lastSocket()

    rejectHandshake()

    expect(socket.removeAllListeners).toHaveBeenCalled()
    expect(socket.disconnect).toHaveBeenCalled()
  })

  it('does not retry inside the handler', async () => {
    const { realtime } = await signedIn()
    realtime.startRealtime()

    rejectHandshake()

    expect(mockIo).toHaveBeenCalledTimes(1)
  })

  it('creates exactly one new socket on the next active event', async () => {
    const { realtime } = await signedIn('token-a')
    realtime.startRealtime()
    rejectHandshake()

    setAppState('active')

    expect(mockIo).toHaveBeenCalledTimes(2)
    await expect(resolveAuth(lastSocket())).resolves.toEqual({ token: 'token-a' })
  })

  it('repeated connect_errors do not stack sockets', async () => {
    const { realtime } = await signedIn()
    realtime.startRealtime()

    rejectHandshake()
    setAppState('active')
    rejectHandshake()
    setAppState('active')
    setAppState('active')

    expect(mockIo).toHaveBeenCalledTimes(3)
    const live = mockSockets.filter((s) => s.disconnect.mock.calls.length === 0)
    expect(live).toHaveLength(1)
  })

  it('a stale connect_error from a replaced socket does not tear down its successor', async () => {
    const { realtime, storage } = await signedIn('token-a')
    realtime.startRealtime()
    const old = lastSocket()
    await storage.persistSession('token-b', user)
    const successor = lastSocket()

    old.handlers['connect_error']?.(new Error('Unauthorized'))

    expect(successor.disconnect).not.toHaveBeenCalled()
    setAppState('active')
    expect(mockIo).toHaveBeenCalledTimes(2)
  })

  it('never logs the token', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const { realtime } = await signedIn('secret-token-xyz')
    realtime.startRealtime()

    rejectHandshake()

    const logged = JSON.stringify([...warn.mock.calls, ...log.mock.calls])
    expect(logged).not.toContain('secret-token-xyz')
    warn.mockRestore()
    log.mockRestore()
  })
})
