import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native'

const mockSecureStore = require('./testing/memorySecureStore').createMemorySecureStore() as ReturnType<
  typeof import('./testing/memorySecureStore').createMemorySecureStore
>

jest.mock('expo-secure-store', () => mockSecureStore)
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))

// Real api.ts + storage.ts + queryClient: a 401 inside a mounted query clears the session, and with it the
// cache, while that very query is in flight. queryClient.clear() cancels that fetch silently, so the
// observer gets no error event (known limitation, see TASK_REVIEW). What must hold: no stale or late data
// lands in the cache, and the 401 does not turn into a request loop.
describe('a 401 raised inside a mounted query (M004 AC3 + AC6)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it('leaves the cache empty, the session cleared and issues exactly one request', async () => {
    mockSecureStore.reset()
    const { queryClient } = require('./queryClient') as typeof import('./queryClient')
    const { useTasks } = require('./queries') as typeof import('./queries')
    const { session } = require('./session') as typeof import('./session')
    // The mounted observer detaches after the 401 already cleared the cache and re-arms a 5-minute gc timer on
    // the orphaned query, which holds jest open. An infinite gcTime means no timer is ever scheduled.
    const defaults = queryClient.getDefaultOptions()
    queryClient.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, gcTime: Infinity } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })
    globalThis.fetch = fetchMock

    const { result } = renderHook(() => useTasks(), { wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(result.current.data).toBeUndefined()
    expect(session.getToken()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    queryClient.clear()
  })
})
