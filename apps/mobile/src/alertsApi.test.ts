export {}

jest.mock('expo-secure-store', () => require('./testing/memorySecureStore').createMemorySecureStore())
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
  Platform: { OS: 'ios' },
}))

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockFetch(body: unknown) {
  const fn = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body })
  globalThis.fetch = fn
  return fn
}

describe('alerts fetchers (M015)', () => {
  it('listLowStock GETs /inventory/alerts/low-stock', async () => {
    const api = require('./api') as typeof import('./api')
    const fetchMock = mockFetch([{ id: 'ing-1' }])

    await expect(api.listLowStock()).resolves.toEqual([{ id: 'ing-1' }])
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/inventory\/alerts\/low-stock$/)
  })

  it('listExpiringSoon GETs /inventory/alerts/expiring with no query string by default', async () => {
    const api = require('./api') as typeof import('./api')
    const fetchMock = mockFetch([])

    await api.listExpiringSoon()
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/inventory\/alerts\/expiring$/)
  })
})
