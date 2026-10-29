import { z } from 'zod'

// Form fields are always strings (TextInput). Schemas validate the strings and transform them into the
// request payload the api.ts function takes, so a screen can never send a shape the API DTO rejects.

export const requiredText = (message: string) => z.string().trim().min(1, message)

// Deliberately permissive: the API's @IsEmail accepts unicode local parts and IDN domains that z.email()
// rejects, and an existing account must always be able to log in. Strict format policing is the API's job.
const LOOSE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .pipe(z.string().regex(LOOSE_EMAIL, 'Enter a valid email address'))

export const MIN_PASSWORD_LENGTH = 8
export const PASSWORD_TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`

/** Blank and non-numeric input is NaN. `Number('')` is 0, which would otherwise pass as a number. */
export function toNumber(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? Number.NaN : Number(trimmed)
}

export const isPositiveNumber = (text: string): boolean => {
  const value = toNumber(text)
  return Number.isFinite(value) && value > 0
}

export function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function splitCommas(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}
