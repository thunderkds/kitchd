import { signOut } from './signOut'

describe('signOut (M012 F3)', () => {
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('clears the session, then navigates to /', async () => {
    const order: string[] = []
    const clear = jest.fn(async () => {
      order.push('clear')
    })
    const navigate = jest.fn((path: string) => {
      order.push(`navigate:${path}`)
    })

    await signOut(clear, navigate)

    expect(order).toEqual(['clear', 'navigate:/'])
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('still navigates to / and resolves (no unhandled rejection) when clearing rejects', async () => {
    const clear = jest.fn().mockRejectedValue(new Error('keychain locked'))
    const navigate = jest.fn()

    await expect(signOut(clear, navigate)).resolves.toBeUndefined()

    expect(navigate).toHaveBeenCalledWith('/')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('logs the failure without leaking anything but the error message', async () => {
    const clear = jest.fn().mockRejectedValue(new Error('keychain locked'))

    await signOut(clear, jest.fn())

    expect(warnSpy.mock.calls[0]).toEqual(['Failed to clear session on sign-out', 'keychain locked'])
  })
})
