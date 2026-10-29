import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native'
import type { StoredUser } from '@kitchenos/shared'
import DashboardScreen from '../app/dashboard'
import { createQueryClient } from './queryClient'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
let mockUser: StoredUser | null = null

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./storage', () => ({ clearSession: jest.fn() }))
jest.mock('./session', () => ({
  session: {
    getUser: () => mockUser,
    setUser: (user: StoredUser) => {
      mockUser = user
    },
  },
}))

// The dashboard also mounts AlertWidgets (M015) and the unread badge (M008), which read via TanStack Query.
jest.mock('./components/AlertWidgets', () => ({ AlertWidgets: () => null }))
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  fetchNotifications: jest.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
}))

const clients: ReturnType<typeof createQueryClient>[] = []

function renderDashboard() {
  const client = createQueryClient()
  // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <DashboardScreen />
    </QueryClientProvider>,
  )
}

const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean))
const base: StoredUser = { id: 'u1', email: 'u1@example.com', organizationId: 'o', kitchenId: 'k', role: 'CHEF' }

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  mockRouter.push.mockReset()
  mockRouter.replace.mockReset()
})

describe('DashboardScreen (M006)', () => {
  it('links to /settings (AC1)', () => {
    mockUser = base
    renderDashboard()

    fireEvent.press(screen.getByText('Open settings'))

    expect(mockRouter.push).toHaveBeenCalledWith('/settings')
  })

  it.each([
    ['simple', '#0d1016', '#86a0ff'],
    ['dark-neon', '#0d1016', '#ff6b8b'],
  ] as const)('uses the %s palette (AC3): background %s, kicker %s', (themePreference, background, kicker) => {
    mockUser = { ...base, themePreference }
    renderDashboard()

    expect(flat(screen.getByTestId('dashboard-screen').props.style).backgroundColor).toBe(background)
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
  })

  it('a user with no stored preference sees the legacy colours (no visual change)', () => {
    mockUser = base
    renderDashboard()

    expect(flat(screen.getByTestId('dashboard-screen').props.style).backgroundColor).toBe('#0d1016')
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe('#86a0ff')
    // Walk up from the label to the Pressable that carries the button background.
    let node = screen.getByText('Sign out').parent
    while (node && !flat(node.props.style).backgroundColor) node = node.parent
    expect(flat(node?.props.style).backgroundColor).toBe('#6b8cff')
  })
})
