import { loginSchema, signupSchema } from './auth'

const errorsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]))

describe('loginSchema (LoginDto: @IsEmail email, @MinLength(1) password)', () => {
  it('accepts a valid login and outputs only email + password', () => {
    const result = loginSchema.safeParse({ email: ' chef@example.com ', password: 'x', organizationName: '', kitchenName: '' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ email: 'chef@example.com', password: 'x' })
  })

  it('does not apply the signup 8-character minimum to login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
  })

  it.each(['', '   ', 'not-an-email', 'a@'])('rejects email %p', (email) => {
    const result = loginSchema.safeParse({ email, password: 'x' })
    expect(result.success).toBe(false)
    expect(errorsOf(result)).toHaveProperty('email')
  })

  it('rejects a blank password', () => {
    const result = loginSchema.safeParse({ email: 'a@b.co', password: '' })
    expect(errorsOf(result)).toEqual({ password: 'Password is required' })
  })
})

describe('email rule is permissive: the API @IsEmail is the strict policeman', () => {
  it.each(['josé@example.com', 'a@münchen.de', 'a@xn--p1ai.xn--p1ai'])('accepts %p in login and signup', (email) => {
    expect(loginSchema.safeParse({ email, password: 'x' }).success).toBe(true)
    expect(
      signupSchema.safeParse({ email, password: '12345678', organizationName: 'O', kitchenName: 'K' }).success,
    ).toBe(true)
  })

  it.each(['abc', 'a@b', 'a b@c.com', '', '   '])('rejects %p', (email) => {
    expect(loginSchema.safeParse({ email, password: 'x' }).success).toBe(false)
  })

  it('keeps the error texts', () => {
    expect(errorsOf(loginSchema.safeParse({ email: '', password: 'x' }))).toEqual({ email: 'Email is required' })
    expect(errorsOf(loginSchema.safeParse({ email: 'a@b', password: 'x' }))).toEqual({
      email: 'Enter a valid email address',
    })
  })
})

describe('signupSchema (SignupDto: email, password >= 8, organizationName, kitchenName)', () => {
  const valid = { email: 'a@b.co', password: 'longenough', organizationName: ' Org ', kitchenName: ' Main ' }

  it('accepts a valid signup and trims names', () => {
    const result = signupSchema.safeParse(valid)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ email: 'a@b.co', password: 'longenough', organizationName: 'Org', kitchenName: 'Main' })
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = signupSchema.safeParse({ ...valid, password: '1234567' })
    expect(errorsOf(result)).toEqual({ password: 'Password must be at least 8 characters.' })
  })

  it('accepts exactly 8 characters', () => {
    expect(signupSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(true)
  })

  it('rejects blank organization and kitchen names', () => {
    const result = signupSchema.safeParse({ ...valid, organizationName: '  ', kitchenName: '' })
    expect(errorsOf(result)).toEqual({
      organizationName: 'Organization name is required',
      kitchenName: 'Kitchen name is required',
    })
  })

  it('rejects a malformed email', () => {
    expect(errorsOf(signupSchema.safeParse({ ...valid, email: 'nope' }))).toHaveProperty('email')
  })
})
