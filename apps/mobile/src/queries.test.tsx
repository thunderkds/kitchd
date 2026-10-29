import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native'
import { createQueryClient } from './queryClient'
import { queryKeys } from './queryKeys'
import { useIngredientRows, useNotes, useTasks } from './queries'
import * as api from './api'

jest.mock('./api', () => ({
  listTasks: jest.fn(),
  listIngredients: jest.fn(),
  listMovements: jest.fn(),
  listNotes: jest.fn(),
  currentStockFromMovements: (movements: { qty: number }[]) => movements.reduce((sum, m) => sum + m.qty, 0),
}))

const mocked = api as jest.Mocked<typeof api>

const clients: ReturnType<typeof createQueryClient>[] = []

function makeWrapper() {
  const client = createQueryClient()
  clients.push(client)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

const task = (id: string) => ({ id, title: `Task ${id}` }) as unknown as api.Task

afterEach(() => {
  // Unmount first, then clear: clearing before unmount lets the observers re-arm gc timers that keep jest alive.
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  // Reset only the api mocks: resetAllMocks would also strip jest-expo's AppState mock.
  for (const fn of [mocked.listTasks, mocked.listIngredients, mocked.listMovements, mocked.listNotes]) {
    ;(fn as jest.Mock).mockReset()
  }
})

describe('useTasks (screen-level hook over a mocked api.ts, M004 AC7)', () => {
  it('reads through listTasks and exposes loading then data', async () => {
    mocked.listTasks.mockResolvedValue([task('t1'), task('t2')])
    const { client, wrapper } = makeWrapper()

    const { result } = renderHook(() => useTasks(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((t) => t.id)).toEqual(['t1', 't2'])
    expect(mocked.listTasks).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(queryKeys.tasks.list())).toHaveLength(2)
  })

  it('surfaces the api error message and does not retry a 401', async () => {
    mocked.listTasks.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
    const { client, wrapper } = makeWrapper()

    const { result } = renderHook(() => useTasks(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Unauthorized')
    expect(mocked.listTasks).toHaveBeenCalledTimes(1)
  })

  it('refetches when the tasks keys are invalidated (what the write paths rely on)', async () => {
    mocked.listTasks.mockResolvedValueOnce([task('t1')]).mockResolvedValueOnce([task('t1'), task('t2')])
    const { client, wrapper } = makeWrapper()

    const { result } = renderHook(() => useTasks(), { wrapper })
    await waitFor(() => expect(result.current.data).toHaveLength(1))

    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.tasks.all })
    })

    await waitFor(() => expect(result.current.data).toHaveLength(2))
  })

  it('does not call the api while disabled', async () => {
    const { client, wrapper } = makeWrapper()

    const { result } = renderHook(() => useTasks(false), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mocked.listTasks).not.toHaveBeenCalled()
  })
})

describe('useNotes', () => {
  it('keys the cache on scope and tag so each filter caches separately', async () => {
    mocked.listNotes.mockResolvedValue([])
    const { client, wrapper } = makeWrapper()

    const { result, rerender } = renderHook(({ scope }: { scope: 'mine' | 'team' }) => useNotes({ scope }), {
      wrapper,
      initialProps: { scope: 'team' as 'mine' | 'team' },
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ scope: 'mine' })
    await waitFor(() => expect(mocked.listNotes).toHaveBeenCalledTimes(2))

    expect(mocked.listNotes).toHaveBeenNthCalledWith(1, { scope: 'team', tag: undefined })
    expect(mocked.listNotes).toHaveBeenNthCalledWith(2, { scope: 'mine', tag: undefined })
  })
})

describe('useIngredientRows', () => {
  it('derives stock per ingredient and degrades a failing ledger read to null stock', async () => {
    mocked.listIngredients.mockResolvedValue([{ id: 'i1', name: 'Flour' }, { id: 'i2', name: 'Salt' }] as api.Ingredient[])
    mocked.listMovements.mockImplementation(async (id: string) => {
      if (id === 'i2') throw new Error('ledger down')
      return [{ qty: 2 }, { qty: 3 }] as api.StockMovement[]
    })
    const { client, wrapper } = makeWrapper()

    const { result } = renderHook(() => useIngredientRows(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { id: 'i1', name: 'Flour', currentStock: 5 },
      { id: 'i2', name: 'Salt', currentStock: null },
    ])
  })
})
