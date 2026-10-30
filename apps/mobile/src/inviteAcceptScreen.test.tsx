import { fireEvent, render, screen } from '@testing-library/react-native'
import AcceptInviteScreen from '../app/invite/accept'
import { expectSafeAreaAndKeyboardAvoidance } from './testing/nativeFrame'

const mockParams: { token?: string | string[] } = {}
const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
}))
jest.mock('./api', () => ({ acceptInvite: jest.fn() }))
jest.mock('./storage', () => ({ persistSession: jest.fn() }))
const mockUser: { current: { email: string } | null } = { current: null }
jest.mock('./session', () => ({ toStoredUser: jest.fn(), session: { getUser: () => mockUser.current } }))

describe('AcceptInviteScreen (M012 F4 component test)', () => {
  afterEach(() => {
    delete mockParams.token
    mockUser.current = null
  })

  it('pre-fills the token from the deep link and keeps typed characters (abc + x -> abcx)', () => {
    mockParams.token = 'abc'
    render(<AcceptInviteScreen />)

    const input = screen.getByPlaceholderText('Invite token')
    expect(input.props.value).toBe('abc')

    fireEvent.changeText(input, 'abcx')

    expect(screen.getByPlaceholderText('Invite token').props.value).toBe('abcx')
  })

  it('takes the first value when the token param repeats', () => {
    mockParams.token = ['abc', 'zzz']
    render(<AcceptInviteScreen />)

    expect(screen.getByPlaceholderText('Invite token').props.value).toBe('abc')
  })

  it('starts empty without a token param', () => {
    render(<AcceptInviteScreen />)

    expect(screen.getByPlaceholderText('Invite token').props.value).toBe('')
  })
})

describe('AcceptInviteScreen native quality (M010)', () => {
  it('AC2 + AC3: sits in the safe area and avoids the keyboard', () => {
    render(<AcceptInviteScreen />)

    expectSafeAreaAndKeyboardAvoidance()
  })
})

describe('AcceptInviteScreen signed-in notice (M013 AC7)', () => {
  afterEach(() => {
    mockUser.current = null
  })

  it('tells a signed-in user who they are signed in as and that accepting replaces it', () => {
    mockUser.current = { email: 'chef@example.com' }
    render(<AcceptInviteScreen />)

    expect(
      screen.getByText(
        'You are signed in as chef@example.com. Accepting this invitation will sign you out of that account and sign you in as the invited user.',
      ),
    ).toBeTruthy()
    // The form is still there: the notice informs, it does not block.
    expect(screen.getByPlaceholderText('Invite token')).toBeTruthy()
  })

  it('shows no notice when signed out', () => {
    render(<AcceptInviteScreen />)

    expect(screen.queryByText(/You are signed in as/)).toBeNull()
  })

  it('reads the user once at mount, like the web page', () => {
    mockUser.current = { email: 'chef@example.com' }
    const { rerender } = render(<AcceptInviteScreen />)

    mockUser.current = { email: 'other@example.com' }
    rerender(<AcceptInviteScreen />)

    expect(screen.getByText(/signed in as chef@example\.com/)).toBeTruthy()
  })
})
