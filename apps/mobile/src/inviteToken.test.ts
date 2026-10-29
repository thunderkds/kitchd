import { inviteTokenFromParam } from './inviteToken'

describe('inviteTokenFromParam', () => {
  it('returns a string param as is', () => {
    expect(inviteTokenFromParam('abc')).toBe('abc')
  })

  it('takes the first value of a repeated param', () => {
    expect(inviteTokenFromParam(['abc', 'def'])).toBe('abc')
  })

  it('returns undefined when the param is missing or empty', () => {
    expect(inviteTokenFromParam(undefined)).toBeUndefined()
    expect(inviteTokenFromParam([])).toBeUndefined()
  })
})
