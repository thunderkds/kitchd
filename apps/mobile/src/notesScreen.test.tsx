import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import NotesScreen from '../app/notes'
import * as api from './api'
import { createQueryClient } from './queryClient'
import { queryKeys } from './queryKeys'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
const mockToken: { current: string | null } = { current: 'token-A' }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: {
    getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }),
    getToken: () => mockToken.current,
  },
}))
jest.mock('./api', () => ({
  listNotes: jest.fn(),
  createNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []
const listKey = queryKeys.notes.list({ scope: 'team' })

function renderScreen() {
  const client = createQueryClient()
  // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  const view = render(
    <QueryClientProvider client={client}>
      <NotesScreen />
    </QueryClientProvider>,
  )
  return { ...view, client }
}

const note = (over: Partial<api.Note> = {}): api.Note => ({
  id: 'note-1',
  kitchenId: 'k1',
  authorId: 'u1',
  title: 'Walk-in fridge',
  body: 'Check the seals',
  tags: [],
  pinned: false,
  linkedEntityType: null,
  linkedEntityId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

beforeEach(() => {
  mockToken.current = 'token-A'
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
})

describe('NotesScreen optimistic pin/delete rollback (M004 P2-1, P2-2)', () => {
  it('rolls the pin back when the update fails', async () => {
    // The refetch after the failure is held open so a missing rollback cannot be masked by it.
    let finishRefetch: (notes: api.Note[]) => void = () => {}
    mocked.listNotes
      .mockResolvedValueOnce([note()])
      .mockReturnValueOnce(new Promise((resolve) => (finishRefetch = resolve)))
    mocked.updateNote.mockRejectedValue(new Error('Conflict'))
    const { client } = renderScreen()

    fireEvent.press(await screen.findByText('Pin'))
    await waitFor(() => expect(mocked.listNotes).toHaveBeenCalledTimes(2))

    expect(client.getQueryData<api.Note[]>(listKey)?.[0].pinned).toBe(false)

    await act(async () => {
      finishRefetch([note()])
    })
    expect(await screen.findByText('Conflict')).toBeTruthy()
    expect(screen.getByText('Pin')).toBeTruthy()
  })

  it('rolls the delete back when the request fails', async () => {
    let finishRefetch: (notes: api.Note[]) => void = () => {}
    mocked.listNotes
      .mockResolvedValueOnce([note()])
      .mockReturnValueOnce(new Promise((resolve) => (finishRefetch = resolve)))
    mocked.deleteNote.mockRejectedValue(new Error('Conflict'))
    const { client } = renderScreen()

    fireEvent.press(await screen.findByText('Delete'))
    await waitFor(() => expect(mocked.listNotes).toHaveBeenCalledTimes(2))

    expect(client.getQueryData<api.Note[]>(listKey)?.map((n) => n.id)).toEqual(['note-1'])

    await act(async () => {
      finishRefetch([note()])
    })
    expect(await screen.findByText('Conflict')).toBeTruthy()
  })

  it('does not write the previous user notes back after the session ended mid-mutation', async () => {
    let rejectUpdate: (error: Error) => void = () => {}
    mocked.listNotes
      .mockResolvedValueOnce([note()])
      .mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
    mocked.updateNote.mockReturnValue(new Promise((_resolve, reject) => (rejectUpdate = reject)))
    const { client } = renderScreen()

    fireEvent.press(await screen.findByText('Pin'))
    await waitFor(() => expect(mocked.updateNote).toHaveBeenCalled())
    expect(client.getQueryData<api.Note[]>(listKey)?.[0].pinned).toBe(true)

    mockToken.current = null
    client.clear()
    await act(async () => {
      rejectUpdate(new Error('Conflict'))
    })

    expect(await screen.findByText('Conflict')).toBeTruthy()
    expect(client.getQueryData(listKey)).toBeUndefined()
  })
})
