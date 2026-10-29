import { cleanup, fireEvent, render, screen } from '@testing-library/react-native'
import DashboardScreen from '../app/dashboard'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./storage', () => ({ clearSession: jest.fn() }))
jest.mock('./signOut', () => ({ signOut: jest.fn() }))
jest.mock('./session', () => ({
  session: { getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }) },
}))

afterEach(() => {
  cleanup()
  mockRouter.push.mockReset()
})

describe('Dashboard (M014 AC3)', () => {
  it('links to the shift log screen', () => {
    render(<DashboardScreen />)

    fireEvent.press(screen.getByText('Open shift log'))

    expect(mockRouter.push).toHaveBeenCalledWith('/shift-logs')
  })
})
