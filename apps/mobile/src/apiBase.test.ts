jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}))

import { resolveApiBase } from './apiBase'

describe('resolveApiBase', () => {
  it('throws outside dev when the env var is unset', () => {
    expect(() => resolveApiBase(undefined, false, 'ios')).toThrow(/EXPO_PUBLIC_API_BASE_URL/)
  })

  it('throws outside dev when the env var is blank', () => {
    expect(() => resolveApiBase('   ', false, 'android')).toThrow(/EXPO_PUBLIC_API_BASE_URL/)
  })

  it('throws outside dev for an http:// url', () => {
    expect(() => resolveApiBase('http://x', false, 'ios')).toThrow(/EXPO_PUBLIC_API_BASE_URL/)
  })

  it('returns an https:// url outside dev (trimmed)', () => {
    expect(resolveApiBase(' https://x ', false, 'ios')).toBe('https://x')
  })

  it('accepts an upper-case scheme outside dev', () => {
    expect(resolveApiBase('HTTPS://x.com', false, 'ios')).toBe('HTTPS://x.com')
  })

  it('throws outside dev for an https:// url with no host', () => {
    expect(() => resolveApiBase('https://', false, 'ios')).toThrow(/EXPO_PUBLIC_API_BASE_URL/)
  })

  it('throws outside dev for input that is not a url', () => {
    expect(() => resolveApiBase('not a url', false, 'ios')).toThrow(/EXPO_PUBLIC_API_BASE_URL/)
  })

  it('falls back to localhost in dev when the env var is unset', () => {
    expect(resolveApiBase(undefined, true, 'ios')).toBe('http://localhost:3000')
  })

  it('falls back to the emulator host on android in dev', () => {
    expect(resolveApiBase(undefined, true, 'android')).toBe('http://10.0.2.2:3000')
  })

  it('accepts an explicit http:// url in dev', () => {
    expect(resolveApiBase('http://192.168.1.5:3000', true, 'ios')).toBe('http://192.168.1.5:3000')
  })
})
