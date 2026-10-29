import { cleanup, fireEvent, render, screen } from '@testing-library/react-native'
import type { StoredUser } from '@kitchenos/shared'
import DashboardScreen from '../app/dashboard'

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

const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean))
const base: StoredUser = { id: 'u1', email: 'u1@example.com', organizationId: 'o', kitchenId: 'k', role: 'CHEF' }

afterEach(() => {
  cleanup()
  mockRouter.push.mockReset()
  mockRouter.replace.mockReset()
})

describe('DashboardScreen (M006)', () => {
  it('links to /settings (AC1)', () => {
    mockUser = base
    render(<DashboardScreen />)

    fireEvent.press(screen.getByText('Open settings'))

    expect(mockRouter.push).toHaveBeenCalledWith('/settings')
  })

  it.each([
    ['simple', '#0d1016', '#86a0ff'],
    ['dark-neon', '#0d1016', '#ff6b8b'],
  ] as const)('uses the %s palette (AC3): background %s, kicker %s', (themePreference, background, kicker) => {
    mockUser = { ...base, themePreference }
    render(<DashboardScreen />)

    expect(flat(screen.getByTestId('dashboard-screen').props.style).backgroundColor).toBe(background)
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
  })

  it('a user with no stored preference sees the legacy colours (no visual change)', () => {
    mockUser = base
    render(<DashboardScreen />)

    expect(flat(screen.getByTestId('dashboard-screen').props.style).backgroundColor).toBe('#0d1016')
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe('#86a0ff')
    // Walk up from the label to the Pressable that carries the button background.
    let node = screen.getByText('Sign out').parent
    while (node && !flat(node.props.style).backgroundColor) node = node.parent
    expect(flat(node?.props.style).backgroundColor).toBe('#6b8cff')
  })
})
