import { z } from 'zod'
import { emailField, MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT, requiredText } from './common'

// InviteUserDto: @IsEmail email, @IsIn(INVITABLE_ROLES) role: never Owner/Admin.
export const INVITABLE_ROLES = ['CHEF', 'STAFF', 'VIEWER'] as const

export const inviteSchema = z.object({
  email: emailField,
  role: z.enum(INVITABLE_ROLES),
})

// AcceptInviteDto: token string, @MinLength(8) password. Web AcceptInvitePage uses the same message.
export const acceptInviteSchema = z.object({
  token: requiredText('Invite token is required'),
  password: z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT),
})

export type InviteFormValues = z.input<typeof inviteSchema>
export type InvitePayload = z.output<typeof inviteSchema>
export type AcceptInviteFormValues = z.input<typeof acceptInviteSchema>
export type AcceptInvitePayload = z.output<typeof acceptInviteSchema>
