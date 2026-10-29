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
    ['simple', '#f6f7fb'],
    ['dark-neon', '#0d1016'],
  ] as const)('uses the %s palette (AC3)', (themePreference, background) => {
    mockUser = { ...base, themePreference }
    render(<DashboardScreen />)

    expect(flat(screen.getByTestId('dashboard-screen').props.style).backgroundColor).toBe(background)
  })
})
