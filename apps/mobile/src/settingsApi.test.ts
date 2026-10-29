export {}

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('./session', () => ({ session: { getToken: () => 'tok', getUser: () => null } }))
jest.mock('./storage', () => ({ clearSession: jest.fn() }))

import { getKitchen, renameKitchen, updateTheme } from './api'

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('M006 api helpers', () => {
  it('updateTheme PATCHes /users/me/theme with the snake_case enum value', async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok({ id: 'u1', email: 'a@b.c', themePreference: 'dark_neon' }))
    globalThis.fetch = fetchMock

    await updateTheme('dark-neon')

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/users\/me\/theme$/)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ theme: 'dark_neon' })
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('getKitchen GETs /kitchens/:id', async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok({ id: 'k1', name: 'Main' }))
    globalThis.fetch = fetchMock

    await expect(getKitchen('k1')).resolves.toEqual({ id: 'k1', name: 'Main' })
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/kitchens\/k1$/)
  })

  it('renameKitchen PATCHes /kitchens/:id with { name }', async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok({ id: 'k1', name: 'New' }))
    globalThis.fetch = fetchMock

    await renameKitchen('k1', 'New')

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/kitchens\/k1$/)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ name: 'New' })
  })
})
