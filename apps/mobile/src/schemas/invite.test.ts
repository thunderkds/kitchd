import { acceptInviteSchema, inviteSchema } from './invite'

const errorsOf = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]))

describe('inviteSchema (InviteUserDto: @IsEmail email, role in CHEF/STAFF/VIEWER)', () => {
  it('accepts a valid invite and trims the email', () => {
    const result = inviteSchema.safeParse({ email: ' new@example.com ', role: 'CHEF' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ email: 'new@example.com', role: 'CHEF' })
  })

  it.each(['', '  ', 'nope', 'a@'])('rejects email %p', (email) => {
    expect(errorsOf(inviteSchema.safeParse({ email, role: 'STAFF' }))).toHaveProperty('email')
  })

  it.each(['josé@example.com', 'a@münchen.de', 'a@xn--p1ai.xn--p1ai'])('accepts the IDN/unicode email %p', (email) => {
    expect(inviteSchema.safeParse({ email, role: 'STAFF' }).success).toBe(true)
  })

  it.each(['abc', 'a@b', 'a b@c.com'])('rejects %p', (email) => {
    expect(errorsOf(inviteSchema.safeParse({ email, role: 'STAFF' }))).toEqual({ email: 'Enter a valid email address' })
  })

  it.each(['OWNER', 'ADMIN', 'BOSS', ''])('rejects the non-invitable role %p', (role) => {
    expect(inviteSchema.safeParse({ email: 'a@b.co', role }).success).toBe(false)
  })
})

describe('acceptInviteSchema (AcceptInviteDto: token, password >= 8)', () => {
  it('accepts a token and an 8+ character password, trimming the token', () => {
    const result = acceptInviteSchema.safeParse({ token: '  abc  ', password: '12345678' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ token: 'abc', password: '12345678' })
  })

  it('rejects a blank token', () => {
    expect(errorsOf(acceptInviteSchema.safeParse({ token: '   ', password: '12345678' }))).toEqual({
      token: 'Invite token is required',
    })
  })

  it('rejects a password shorter than 8 characters (web parity message)', () => {
    expect(errorsOf(acceptInviteSchema.safeParse({ token: 't', password: '1234567' }))).toEqual({
      password: 'Password must be at least 8 characters.',
    })
  })
})
