import { createComment, deleteComment, listComments } from './api'

jest.mock('./session', () => ({ session: { getToken: () => 'tok' } }))
jest.mock('./storage', () => ({ clearSession: jest.fn() }))
jest.mock('./onUnauthorized', () => ({ redirectToSignIn: jest.fn() }))

const originalFetch = globalThis.fetch

function mockFetch(body: unknown) {
  const fn = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body })
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('comments API (M007)', () => {
  it('GET /comments carries entityType and entityId as query params', async () => {
    const fetchMock = mockFetch([])
    await listComments('task', 'task 1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/comments\?entityType=task&entityId=task\+1$/)
    expect(init.method).toBeUndefined()
  })

  it('POST /comments sends entityType, entityId and body', async () => {
    const fetchMock = mockFetch({ id: 'c1' })
    await createComment({ entityType: 'task', entityId: 'task-1', body: 'hi @sam' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/comments$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ entityType: 'task', entityId: 'task-1', body: 'hi @sam' })
  })

  it('DELETE /comments/:id', async () => {
    const fetchMock = mockFetch({ id: 'c1' })
    await deleteComment('c1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/comments\/c1$/)
    expect(init.method).toBe('DELETE')
  })
})
