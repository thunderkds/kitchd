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
  let storage!: typeof import('./storage')
  let signOutModule!: typeof import('./signOut')
  let queryClientModule!: typeof import('./queryClient')
  jest.isolateModules(() => {
    storage = require('./storage')
    api = require('./api')
    signOutModule = require('./signOut')
    queryClientModule = require('./queryClient')
  })
  return { api, storage, signOut: signOutModule.signOut, queryClient: queryClientModule.queryClient }
}

function seedCache(queryClient: import('@tanstack/react-query').QueryClient) {
  queryClient.setQueryData(['tasks', 'list'], [{ id: 'user-a-task' }])
  queryClient.setQueryData(['notes', 'list', { scope: 'mine' }], [{ id: 'user-a-note' }])
  expect(queryClient.getQueryCache().getAll()).toHaveLength(2)
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  mockSecureStore.reset()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('logout clears the query cache (M004 AC6)', () => {
  it('clearSession() empties the cache so user A data cannot render for user B', async () => {
    const { storage, queryClient } = loadModules()
    await storage.sessionReady
    await storage.persistSession('token-a', user)
    seedCache(queryClient)

    await storage.clearSession()

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(queryClient.getQueryData(['tasks', 'list'])).toBeUndefined()
  })

  it('still empties the cache when deleting the SecureStore blob rejects', async () => {
    const { storage, queryClient } = loadModules()
    await storage.sessionReady
    seedCache(queryClient)
    mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('keychain locked'))

    await expect(storage.clearSession()).rejects.toThrow('keychain locked')

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('the 401 path in request() empties the cache', async () => {
    const { api, storage, queryClient } = loadModules()
    await storage.sessionReady
    await storage.persistSession('token-a', user)
    seedCache(queryClient)
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })

    await expect(api.listTasks()).rejects.toThrow('Unauthorized')

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('the sign-out path (signOut(clearSession, navigate)) empties the cache before navigating', async () => {
    const { storage, signOut, queryClient } = loadModules()
    await storage.sessionReady
    await storage.persistSession('token-a', user)
    seedCache(queryClient)
    const navigate = jest.fn(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    })

    await signOut(storage.clearSession, navigate)

    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('persisting a new session (login/accept as another user) drops the previous user cache too', async () => {
    const { storage, queryClient } = loadModules()
    await storage.sessionReady
    await storage.persistSession('token-a', user)
    seedCache(queryClient)

    await storage.persistSession('token-b', { ...user, id: 'user-2', email: 'staff@example.com' })

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
