import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native'
import DashboardScreen from '../app/dashboard'
import { createQueryClient } from './queryClient'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./storage', () => ({ clearSession: jest.fn() }))
jest.mock('./signOut', () => ({ signOut: jest.fn() }))
jest.mock('./session', () => ({
  session: { getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }) },
}))
// The dashboard now mounts AlertWidgets (M015) and the unread badge (M008), which read via TanStack Query; stub the network layer.
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  listLowStock: jest.fn().mockResolvedValue([]),
  listExpiringSoon: jest.fn().mockResolvedValue([]),
  fetchNotifications: jest.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
}))

const clients: ReturnType<typeof createQueryClient>[] = []

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  mockRouter.push.mockReset()
})

describe('Dashboard (M014 AC3)', () => {
  it('links to the shift log screen', () => {
    const client = createQueryClient()
    // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
    client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
    clients.push(client)
    render(
      <QueryClientProvider client={client}>
        <DashboardScreen />
      </QueryClientProvider>,
    )

    fireEvent.press(screen.getByText('Open shift log'))

    expect(mockRouter.push).toHaveBeenCalledWith('/shift-logs')
  })
})
