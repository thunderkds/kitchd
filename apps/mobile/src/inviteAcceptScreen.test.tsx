import { fireEvent, render, screen } from '@testing-library/react-native'
import AcceptInviteScreen from '../app/invite/accept'

const mockParams: { token?: string | string[] } = {}
const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
}))
jest.mock('./api', () => ({ acceptInvite: jest.fn() }))
jest.mock('./storage', () => ({ persistSession: jest.fn() }))
jest.mock('./session', () => ({ toStoredUser: jest.fn() }))

describe('AcceptInviteScreen (M012 F4 component test)', () => {
  afterEach(() => {
    delete mockParams.token
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
