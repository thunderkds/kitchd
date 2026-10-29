import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import TeamScreen from '../app/team'
import * as api from './api'
import { createQueryClient } from './queryClient'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
const mockCaller: { current: { id: string; email: string; role: string } | null } = {
  current: { id: 'me', email: 'owner@example.com', role: 'OWNER' },
}

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({ session: { getUser: () => mockCaller.current } }))
jest.mock('./api', () => ({
  listMembers: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function renderScreen() {
  const client = createQueryClient()
  // A mutation's default 5 min gc timer outlives client.clear() and keeps jest from exiting.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <TeamScreen />
    </QueryClientProvider>,
  )
}

const m = (id: string, role: api.TeamMember['role']): api.TeamMember => ({
  id,
  email: `${id}@example.com`,
  role,
  isActive: true,
})

const roster = [m('me', 'OWNER'), m('adm', 'ADMIN'), m('chef', 'CHEF'), m('staff', 'STAFF')]

beforeEach(() => {
  mockCaller.current = { id: 'me', email: 'owner@example.com', role: 'OWNER' }
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
  jest.restoreAllMocks()
})

describe('TeamScreen controls visibility (M017 AC1, AC3)', () => {
  it('OWNER sees role + remove controls only on CHEF/STAFF/VIEWER rows that are not self', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    renderScreen()
    await screen.findByText('chef@example.com')

    expect(screen.getByLabelText('Remove chef@example.com')).toBeTruthy()
    expect(screen.getByLabelText('Remove staff@example.com')).toBeTruthy()
    expect(screen.getByLabelText('Set role of chef@example.com to STAFF')).toBeTruthy()
    // self (OWNER) and ADMIN rows: no controls
    expect(screen.queryByLabelText('Remove me@example.com')).toBeNull()
    expect(screen.queryByLabelText('Remove adm@example.com')).toBeNull()
    expect(screen.queryByLabelText(/Set role of me@example.com/)).toBeNull()
    expect(screen.queryByLabelText(/Set role of adm@example.com/)).toBeNull()
  })

  it('role picker offers only CHEF/STAFF/VIEWER (never OWNER/ADMIN)', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    renderScreen()
    await screen.findByText('chef@example.com')

    expect(screen.getByLabelText('Set role of chef@example.com to VIEWER')).toBeTruthy()
    expect(screen.queryByLabelText('Set role of chef@example.com to OWNER')).toBeNull()
    expect(screen.queryByLabelText('Set role of chef@example.com to ADMIN')).toBeNull()
  })

  it('ADMIN caller gets the same controls and none on own row', async () => {
    mockCaller.current = { id: 'adm', email: 'adm@example.com', role: 'ADMIN' }
    mocked.listMembers.mockResolvedValue(roster)
    renderScreen()
    await screen.findByText('chef@example.com')

    expect(screen.getByLabelText('Remove chef@example.com')).toBeTruthy()
    expect(screen.queryByLabelText('Remove adm@example.com')).toBeNull()
  })

  it.each(['CHEF', 'STAFF', 'VIEWER'])(
    '%s caller never fetches the roster and sees the restricted message (M017 follow-up)',
    async (role) => {
      mockCaller.current = { id: 'chef', email: 'chef@example.com', role }
      mocked.listMembers.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
      renderScreen()

      expect(await screen.findByText('Team management is available to Owners and Admins only.')).toBeTruthy()
      // Give any (unwanted) request time to fail and render its error.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(mocked.listMembers).not.toHaveBeenCalled()
      expect(screen.queryByText('Forbidden')).toBeNull()
      expect(screen.queryByText('Loading members...')).toBeNull()
      expect(screen.queryByText('No team members returned.')).toBeNull()
      expect(screen.queryByLabelText(/^Remove /)).toBeNull()
      expect(screen.queryByLabelText(/^Set role of /)).toBeNull()
    },
  )
})

describe('TeamScreen role change (M017 AC1)', () => {
  it('calls updateMemberRole(id, role) and refreshes the list', async () => {
    mocked.listMembers.mockResolvedValueOnce(roster)
    mocked.updateMemberRole.mockResolvedValue({ ...m('chef', 'VIEWER') })
    mocked.listMembers.mockResolvedValue([
      m('me', 'OWNER'),
      m('adm', 'ADMIN'),
      m('chef', 'VIEWER'),
      m('staff', 'STAFF'),
    ])
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Set role of chef@example.com to VIEWER'))

    await waitFor(() => expect(mocked.updateMemberRole).toHaveBeenCalledWith('chef', 'VIEWER'))
    await waitFor(() => expect(mocked.listMembers).toHaveBeenCalledTimes(2))
  })

  it('does not call the API when the already-current role is pressed', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Set role of chef@example.com to CHEF'))

    expect(mocked.updateMemberRole).not.toHaveBeenCalled()
  })

  it('shows the server error when the role change fails', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    mocked.updateMemberRole.mockRejectedValue(new Error('Cannot change the role of an Owner/Admin'))
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Set role of chef@example.com to STAFF'))

    expect(await screen.findByText('Cannot change the role of an Owner/Admin')).toBeTruthy()
  })
})

describe('TeamScreen remove (M017 AC2)', () => {
  it('asks for confirmation first and does NOT call the API on press', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Remove chef@example.com'))

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(mocked.removeMember).not.toHaveBeenCalled()
  })

  it('cancelling the confirm does not call the API', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Remove chef@example.com'))
    const buttons = alertSpy.mock.calls[0][2] ?? []
    const cancel = buttons.find((b) => b.style === 'cancel')
    expect(cancel).toBeTruthy()
    await act(async () => {
      cancel?.onPress?.()
    })

    expect(mocked.removeMember).not.toHaveBeenCalled()
  })

  it('confirming calls removeMember(id) and refreshes the list', async () => {
    mocked.listMembers.mockResolvedValueOnce(roster)
    mocked.listMembers.mockResolvedValue(roster.filter((x) => x.id !== 'chef'))
    mocked.removeMember.mockResolvedValue({ ...m('chef', 'CHEF'), isActive: false })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Remove chef@example.com'))
    const buttons = alertSpy.mock.calls[0][2] ?? []
    const destructive = buttons.find((b) => b.style === 'destructive')
    expect(destructive).toBeTruthy()
    await act(async () => {
      destructive?.onPress?.()
    })

    await waitFor(() => expect(mocked.removeMember).toHaveBeenCalledWith('chef'))
    await waitFor(() => expect(screen.queryByText('chef@example.com')).toBeNull())
  })

  it('shows the server error when the removal fails', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    mocked.removeMember.mockRejectedValue(new Error('Cannot remove an Owner/Admin'))
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Remove chef@example.com'))
    const destructive = (alertSpy.mock.calls[0][2] ?? []).find((b) => b.style === 'destructive')
    await act(async () => {
      destructive?.onPress?.()
    })

    expect(await screen.findByText('Cannot remove an Owner/Admin')).toBeTruthy()
    expect(screen.getByText('chef@example.com')).toBeTruthy()
  })
})

describe('TeamScreen double-submit guard (M017 review P2)', () => {
  const deferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => {
      resolve = res
    })
    return { promise, resolve }
  }

  it('ignores a second role chip press while a role change is pending', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    const pending = deferred<api.TeamMember>()
    mocked.updateMemberRole.mockReturnValue(pending.promise)
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Set role of chef@example.com to VIEWER'))
    await waitFor(() => expect(mocked.updateMemberRole).toHaveBeenCalledTimes(1))

    const second = screen.getByLabelText('Set role of staff@example.com to VIEWER')
    expect(second.props.accessibilityState.disabled).toBe(true)
    fireEvent.press(second)
    fireEvent.press(screen.getByLabelText('Set role of chef@example.com to STAFF'))

    expect(mocked.updateMemberRole).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(m('chef', 'VIEWER'))
    })
  })

  it('disables Remove while a role change is pending', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    const pending = deferred<api.TeamMember>()
    mocked.updateMemberRole.mockReturnValue(pending.promise)
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Set role of chef@example.com to VIEWER'))
    await waitFor(() => expect(mocked.updateMemberRole).toHaveBeenCalledTimes(1))

    const remove = screen.getByLabelText('Remove staff@example.com')
    expect(remove.props.accessibilityState.disabled).toBe(true)
    fireEvent.press(remove)
    expect(alertSpy).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve(m('chef', 'VIEWER'))
    })
  })

  it('disables the role chips while a removal is pending', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    const pending = deferred<api.TeamMember>()
    mocked.removeMember.mockReturnValue(pending.promise)
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Remove chef@example.com'))
    const destructive = (alertSpy.mock.calls[0][2] ?? []).find((b) => b.style === 'destructive')
    await act(async () => {
      destructive?.onPress?.()
    })
    await waitFor(() => expect(mocked.removeMember).toHaveBeenCalledTimes(1))

    const chip = screen.getByLabelText('Set role of staff@example.com to VIEWER')
    expect(chip.props.accessibilityState.disabled).toBe(true)
    fireEvent.press(chip)
    expect(mocked.updateMemberRole).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve({ ...m('chef', 'CHEF'), isActive: false })
    })
  })

  it('re-enables the controls once the mutation settles', async () => {
    mocked.listMembers.mockResolvedValue(roster)
    mocked.updateMemberRole.mockResolvedValue(m('chef', 'VIEWER'))
    renderScreen()
    await screen.findByText('chef@example.com')

    fireEvent.press(screen.getByLabelText('Set role of chef@example.com to VIEWER'))
    await waitFor(() => expect(mocked.updateMemberRole).toHaveBeenCalledTimes(1))

    await waitFor(() =>
      expect(screen.getByLabelText('Remove staff@example.com').props.accessibilityState.disabled).toBe(false),
    )
  })
})
