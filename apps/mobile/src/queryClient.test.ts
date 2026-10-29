export {}

const mockRemove = jest.fn()
const mockAddEventListener = jest.fn((_type: string, _handler: (state: string) => void) => ({ remove: mockRemove }))

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (type: string, handler: (state: string) => void) => mockAddEventListener(type, handler),
  },
  Platform: { OS: 'ios' },
}))

function statusError(status: number) {
  return Object.assign(new Error(`Request failed (${status})`), { status })
}

describe('retry policy (M004 AC3)', () => {
  const { createQueryClient, shouldRetry } = require('./queryClient') as typeof import('./queryClient')

  it.each([401, 403, 404])('never retries a %i', (status) => {
    expect(shouldRetry(0, statusError(status))).toBe(false)
  })

  it('retries other failures exactly once', () => {
    expect(shouldRetry(0, statusError(500))).toBe(true)
    expect(shouldRetry(1, statusError(500))).toBe(false)
  })

  it('retries an error without a status (network failure) once', () => {
    expect(shouldRetry(0, new TypeError('Network request failed'))).toBe(true)
    expect(shouldRetry(1, new TypeError('Network request failed'))).toBe(false)
  })

  it('a 401 reaches the queryFn once; a 500 reaches it twice (default options of the real client)', async () => {
    const client = createQueryClient()

    const unauthorized = jest.fn().mockRejectedValue(statusError(401))
    await expect(client.fetchQuery({ queryKey: ['t', 401], queryFn: unauthorized, retryDelay: 0 })).rejects.toThrow(
      'Request failed (401)',
    )
    expect(unauthorized).toHaveBeenCalledTimes(1)

    const serverError = jest.fn().mockRejectedValue(statusError(500))
    await expect(client.fetchQuery({ queryKey: ['t', 500], queryFn: serverError, retryDelay: 0 })).rejects.toThrow(
      'Request failed (500)',
    )
    expect(serverError).toHaveBeenCalledTimes(2)
    client.clear()
  })
})

describe('focusManager wiring (M004 AC2)', () => {
  it('maps AppState "active" to focused and detaches the AppState subscription on unsubscribe', () => {
    const { focusManager } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
    require('./queryClient')
    const listener = jest.fn()

    const unsubscribe = focusManager.subscribe(listener)

    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    const onChange = mockAddEventListener.mock.calls[0][1]

    onChange('background')
    expect(focusManager.isFocused()).toBe(false)
    expect(listener).toHaveBeenLastCalledWith(false)

    onChange('inactive')
    expect(focusManager.isFocused()).toBe(false)

    onChange('active')
    expect(focusManager.isFocused()).toBe(true)
    expect(listener).toHaveBeenLastCalledWith(true)

    unsubscribe()
    expect(mockRemove).toHaveBeenCalledTimes(1)
  })
})
