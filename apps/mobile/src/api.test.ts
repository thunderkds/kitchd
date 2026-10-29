export {}

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

const user = {
  id: 'user-1',
  email: 'chef@example.com',
  organizationId: 'org-1',
  kitchenId: 'kitchen-1',
  role: 'CHEF' as const,
}

function loadModules() {
  let api!: typeof import('./api')
  let session!: typeof import('./session')
  let storage!: typeof import('./storage')
  jest.isolateModules(() => {
    storage = require('./storage')
    session = require('./session')
    api = require('./api')
  })
  return { api, session: session.session, storage }
}

function mockResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  mockSecureStore.reset()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('request(): 401 handling (M012 F1)', () => {
  it('rejects with the API message and clears the stored and in-memory session on 401', async () => {
    const { api, session, storage } = loadModules()
    await storage.sessionReady
    await storage.persistSession('token-123', user)
    expect(session.getToken()).toBe('token-123')
    expect(mockSecureStore.data.has('session')).toBe(true)

    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(401, { message: 'Unauthorized' }))

    await expect(api.listTasks()).rejects.toThrow('Unauthorized')

    expect(mockSecureStore.data.has('session')).toBe(false)
    expect(session.getToken()).toBeNull()
    expect(session.getUser()).toBeNull()
  })

  it('keeps the generic message when a 401 has no JSON body', async () => {
    const { api, storage } = loadModules()
    await storage.sessionReady
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => {
        throw new Error('not json')
      },
    })

    await expect(api.listTasks()).rejects.toThrow('Request failed (401)')
  })

  it('does not clear the session on other errors such as 403 or 500', async () => {
    const { api, session, storage } = loadModules()
    await storage.sessionReady
    await storage.persistSession('token-123', user)

    for (const status of [403, 500]) {
      globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(status, { message: 'nope' }))
      await expect(api.listTasks()).rejects.toThrow('nope')
    }

    expect(session.getToken()).toBe('token-123')
    expect(mockSecureStore.data.has('session')).toBe(true)
  })

  it('still rejects with the original message when clearing the session fails', async () => {
    const { api, storage } = loadModules()
    await storage.sessionReady
    await storage.persistSession('token-123', user)
    mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('keychain locked'))
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(401, { message: 'Unauthorized' }))

    await expect(api.listTasks()).rejects.toThrow('Unauthorized')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('does not wipe a newer session when a stale request (sent with the old token) gets a 401', async () => {
    const { api, session, storage } = loadModules()
    await storage.sessionReady
    await storage.persistSession('OLD', user)

    let resolveFetch!: (res: unknown) => void
    globalThis.fetch = jest.fn().mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)))
    const pending = api.listTasks()
    const assertion = expect(pending).rejects.toThrow('Unauthorized')

    await storage.clearSession()
    await storage.persistSession('NEW', user)
    resolveFetch(mockResponse(401, { message: 'Unauthorized' }))
    await assertion

    expect(session.getToken()).toBe('NEW')
    expect(JSON.parse(mockSecureStore.data.get('session')!).accessToken).toBe('NEW')
  })

  it('sends the bearer token and returns the body on success', async () => {
    const { api, storage } = loadModules()
    await storage.sessionReady
    await storage.persistSession('token-123', user)
    const fetchMock = jest.fn().mockResolvedValue(mockResponse(200, [{ id: 't1' }]))
    globalThis.fetch = fetchMock

    await expect(api.listTasks()).resolves.toEqual([{ id: 't1' }])
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-123')
  })
})

describe('request(): error status (M004 AC3)', () => {
  it.each([401, 403, 404, 500])('attaches status %i to the thrown error and keeps the message', async (status) => {
    const { api, storage } = loadModules()
    await storage.sessionReady
    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(status, { message: 'nope' }))

    await expect(api.listTasks()).rejects.toMatchObject({ message: 'nope', status })
  })

  it('attaches the status when the error body is not JSON, with the generic message unchanged', async () => {
    const { api, storage } = loadModules()
    await storage.sessionReady
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json')
      },
    })

    await expect(api.listTasks()).rejects.toMatchObject({ message: 'Request failed (502)', status: 502 })
  })
})
