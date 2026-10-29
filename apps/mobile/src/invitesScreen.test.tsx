import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import InvitesScreen from '../app/invites'
import * as api from './api'
import { createQueryClient } from './queryClient'
import { queryKeys } from './queryKeys'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
const mockToken: { current: string | null } = { current: 'token-A' }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: {
    getUser: () => ({ id: 'u1', email: 'owner@example.com', role: 'OWNER' }),
    getToken: () => mockToken.current,
  },
}))
jest.mock('./api', () => ({
  listPendingInvites: jest.fn(),
  inviteMember: jest.fn(),
  revokeInvite: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function renderScreen() {
  const client = createQueryClient()
  // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  const view = render(
    <QueryClientProvider client={client}>
      <InvitesScreen />
    </QueryClientProvider>,
  )
  return { ...view, client }
}

const invite: api.PendingInvite = {
  id: 'inv-1',
  email: 'new@example.com',
  role: 'STAFF',
  status: 'PENDING',
  token: 'tok',
  expiresAt: '2026-12-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
}

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

describe('InvitesScreen optimistic revoke rollback (M004 P2-1, P2-2)', () => {
  it('rolls the revoke back when the request fails', async () => {
    // The refetch after the failure is held open so a missing rollback cannot be masked by it.
    let finishRefetch: (invites: api.PendingInvite[]) => void = () => {}
    mocked.listPendingInvites
      .mockResolvedValueOnce([invite])
      .mockReturnValueOnce(new Promise((resolve) => (finishRefetch = resolve)))
    mocked.revokeInvite.mockRejectedValue(new Error('Conflict'))
    const { client } = renderScreen()

    fireEvent.press(await screen.findByText('Revoke'))
    await waitFor(() => expect(mocked.listPendingInvites).toHaveBeenCalledTimes(2))

    expect(client.getQueryData<api.PendingInvite[]>(queryKeys.invites.list())?.map((i) => i.id)).toEqual(['inv-1'])

    await act(async () => {
      finishRefetch([invite])
    })
    expect(await screen.findByText('Conflict')).toBeTruthy()
    expect(screen.getByText('new@example.com')).toBeTruthy()
  })

  it('does not write the previous user invites back after the session ended mid-mutation', async () => {
    let rejectRevoke: (error: Error) => void = () => {}
    mocked.listPendingInvites
      .mockResolvedValueOnce([invite])
      .mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
    mocked.revokeInvite.mockReturnValue(new Promise((_resolve, reject) => (rejectRevoke = reject)))
    const { client } = renderScreen()

    fireEvent.press(await screen.findByText('Revoke'))
    await waitFor(() => expect(mocked.revokeInvite).toHaveBeenCalled())
    expect(client.getQueryData<api.PendingInvite[]>(queryKeys.invites.list())).toEqual([])

    mockToken.current = null
    client.clear()
    await act(async () => {
      rejectRevoke(new Error('Conflict'))
    })

    expect(await screen.findByText('Conflict')).toBeTruthy()
    expect(client.getQueryData(queryKeys.invites.list())).toBeUndefined()
  })
})
