import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react-native'
import DashboardScreen from '../app/dashboard'
import { createQueryClient } from './queryClient'

// M013 AC5: with no signed-in user the dashboard must hand off to <Redirect>, not call
// router.replace while rendering (React warns, and the navigation can fire twice).

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native')
    return <Text testID="redirect">{href}</Text>
  },
}))
jest.mock('./storage', () => ({ clearSession: jest.fn() }))
jest.mock('./session', () => ({ session: { getUser: () => null } }))
jest.mock('./components/AlertWidgets', () => ({ AlertWidgets: () => null }))
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  fetchNotifications: jest.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
}))

afterEach(() => {
  cleanup()
  mockRouter.replace.mockReset()
})

describe('DashboardScreen without a user (M013 AC5)', () => {
  it('renders <Redirect href="/"> and never calls router.replace itself', () => {
    const client = createQueryClient()
    render(
      <QueryClientProvider client={client}>
        <DashboardScreen />
      </QueryClientProvider>,
    )

    expect(screen.getByTestId('redirect').props.children).toBe('/')
    expect(mockRouter.replace).not.toHaveBeenCalled()
    expect(screen.queryByTestId('dashboard-screen')).toBeNull()
    client.clear()
  })
})
