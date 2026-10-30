import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import HomeScreen from '../app/index'

// M013 AC6: a proxy/gateway error page (HTML) is not JSON; the user must see the status, not a
// JSON SyntaxError. Login stays on raw fetch on purpose: request() would run its 401 handler
// with no tokens at all.

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
const mockPersistSession = jest.fn()

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./storage', () => ({ persistSession: (...args: unknown[]) => mockPersistSession(...args) }))
jest.mock('./session', () => ({
  session: { getUser: () => null },
  toStoredUser: (user: unknown) => user,
}))

const originalFetch = globalThis.fetch
const fetchMock = jest.fn()

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
  mockPersistSession.mockReset()
  mockRouter.replace.mockReset()
  globalThis.fetch = originalFetch
})

function submitLogin() {
  render(<HomeScreen />)
  fireEvent.press(screen.getAllByText('Log in')[0])
  fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.co')
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'x')
  fireEvent.press(screen.getAllByText('Log in')[1])
}

describe('login error body parsing (M013 AC6)', () => {
  it('shows "Request failed (502)" when the error body is HTML', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token '<', \"<html>\" is not valid JSON")
      },
    })

    submitLogin()

    expect(await screen.findByText('Request failed (502)')).toBeTruthy()
    expect(screen.queryByText(/Unexpected token/)).toBeNull()
    expect(mockPersistSession).not.toHaveBeenCalled()
  })

  it('still shows the JSON message when the API sends one', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' }),
    })

    submitLogin()

    expect(await screen.findByText('Invalid credentials')).toBeTruthy()
  })

  it('falls back to the status when the JSON body has no message', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })

    submitLogin()

    expect(await screen.findByText('Request failed (500)')).toBeTruthy()
  })

  it('a successful login still persists the session', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ accessToken: 't', user: { id: 'u1', email: 'a@b.co', role: 'OWNER' } }),
    })

    submitLogin()

    await waitFor(() => expect(mockPersistSession).toHaveBeenCalledTimes(1))
    expect(mockPersistSession.mock.calls[0][0]).toBe('t')
  })
})
