import { z } from 'zod'
import { requiredText, splitLines } from './common'

// CreateGuidelineDto: @MinLength(1) title, @IsEnum type, steps array (empty is allowed: a draft).
export const GUIDELINE_FORM_TYPES = ['SOP', 'CHECKLIST'] as const

export const guidelineSchema = z
  .object({
    title: requiredText('Guideline title is required'),
    type: z.enum(GUIDELINE_FORM_TYPES),
    steps: z.string(),
  })
  .transform((value) => ({ title: value.title, type: value.type, steps: splitLines(value.steps) }))

export type GuidelineFormValues = z.input<typeof guidelineSchema>
export type GuidelinePayload = z.output<typeof guidelineSchema>
