import { z } from 'zod'
import { emailField, MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT, requiredText } from './common'

// LoginDto: @IsEmail email, @MinLength(1) password. Login must not enforce the signup minimum,
// accounts created before it existed still have to be able to sign in.
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
})

// SignupDto: @IsEmail email, @MinLength(8) password, @MinLength(1) organizationName and kitchenName.
export const signupSchema = z.object({
  email: emailField,
  password: z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT),
  organizationName: requiredText('Organization name is required'),
  kitchenName: requiredText('Kitchen name is required'),
})

/** The login/signup screen holds all four inputs; each schema picks the ones its endpoint takes. */
export type AuthFormValues = { email: string; password: string; organizationName: string; kitchenName: string }
export type LoginPayload = z.output<typeof loginSchema>
export type SignupPayload = z.output<typeof signupSchema>
