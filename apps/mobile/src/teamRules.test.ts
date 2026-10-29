import { ASSIGNABLE_ROLES, canManageMember, canManageTeam } from './teamRules'

const member = (id: string, role: 'OWNER' | 'ADMIN' | 'CHEF' | 'STAFF' | 'VIEWER') => ({
  id,
  email: `${id}@example.com`,
  role,
  isActive: true,
})

describe('teamRules (M017: mirrors users.service PROTECTED_ROLES + web TeamPage)', () => {
  it('offers exactly the DTO INVITABLE_ROLES, never OWNER/ADMIN', () => {
    expect([...ASSIGNABLE_ROLES]).toEqual(['CHEF', 'STAFF', 'VIEWER'])
  })

  it('only OWNER and ADMIN can manage the team', () => {
    expect(canManageTeam('OWNER')).toBe(true)
    expect(canManageTeam('ADMIN')).toBe(true)
    expect(canManageTeam('CHEF')).toBe(false)
    expect(canManageTeam('STAFF')).toBe(false)
    expect(canManageTeam('VIEWER')).toBe(false)
    expect(canManageTeam(undefined)).toBe(false)
  })

  it('allows managing CHEF/STAFF/VIEWER targets', () => {
    for (const role of ['CHEF', 'STAFF', 'VIEWER'] as const) {
      expect(canManageMember({ id: 'me', role: 'OWNER' }, member('t', role))).toBe(true)
    }
  })

  it('blocks OWNER and ADMIN targets (service: Cannot change/remove an Owner/Admin)', () => {
    expect(canManageMember({ id: 'me', role: 'OWNER' }, member('t', 'OWNER'))).toBe(false)
    expect(canManageMember({ id: 'me', role: 'OWNER' }, member('t', 'ADMIN'))).toBe(false)
    expect(canManageMember({ id: 'me', role: 'ADMIN' }, member('t', 'ADMIN'))).toBe(false)
  })

  it('blocks the caller own row', () => {
    expect(canManageMember({ id: 't', role: 'ADMIN' }, member('t', 'CHEF'))).toBe(false)
  })

  it('blocks everything for non-OWNER/ADMIN callers and signed-out', () => {
    expect(canManageMember({ id: 'me', role: 'CHEF' }, member('t', 'STAFF'))).toBe(false)
    expect(canManageMember(null, member('t', 'STAFF'))).toBe(false)
  })
})
