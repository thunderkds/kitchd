import { cleanup, fireEvent, render, screen } from '@testing-library/react-native'
import HomeScreen from '../app/index'
import { expectSafeAreaAndKeyboardAvoidance } from './testing/nativeFrame'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
const mockUser: { current: unknown } = { current: null }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./storage', () => ({ persistSession: jest.fn() }))
jest.mock('./session', () => ({
  session: { getUser: () => mockUser.current },
  toStoredUser: jest.fn(),
}))

afterEach(() => {
  cleanup()
  mockUser.current = null
  mockRouter.push.mockReset()
  mockRouter.replace.mockReset()
})

describe('Login screen invite entry (M017 AC4)', () => {
  it('signed out: shows "I have an invite" and pushes /invite/accept with no param', () => {
    render(<HomeScreen />)

    fireEvent.press(screen.getByText('I have an invite'))

    expect(mockRouter.push).toHaveBeenCalledWith('/invite/accept')
  })

  it('has a button role + label for accessibility', () => {
    render(<HomeScreen />)

    expect(screen.getByRole('link', { name: 'I have an invite' })).toBeTruthy()
  })
})

describe('Login screen native quality (M010)', () => {
  it('AC2 + AC3: sits in the safe area and avoids the keyboard', () => {
    render(<HomeScreen />)

    expectSafeAreaAndKeyboardAvoidance()
  })
})
