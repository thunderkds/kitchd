const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }))

import { redirectToSignIn } from './onUnauthorized'

describe('redirectToSignIn', () => {
  beforeEach(() => {
    mockReplace.mockReset()
  })

  it('replaces the current route with the sign-in screen', () => {
    redirectToSignIn()

    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('swallows a navigation failure and logs only its message', () => {
    mockReplace.mockImplementation(() => {
      throw new Error('Attempted to navigate before mounting the Root Layout')
    })
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(() => redirectToSignIn()).not.toThrow()
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to redirect to sign-in after 401',
      'Attempted to navigate before mounting the Root Layout',
    )
    warnSpy.mockRestore()
  })
})
