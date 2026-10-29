import { z } from 'zod'
import { requiredText, splitCommas } from './common'

// CreateNoteDto: title optional, @MinLength(1) body, tags @ArrayMaxSize(50).
export const MAX_NOTE_TAGS = 50

export const noteSchema = z
  .object({
    title: z.string().trim(),
    body: requiredText('Note body is required'),
    tags: z.string().refine((text) => splitCommas(text).length <= MAX_NOTE_TAGS, `A note can have at most ${MAX_NOTE_TAGS} tags`),
  })
  .transform((value) => ({
    title: value.title || undefined,
    body: value.body,
    tags: splitCommas(value.tags),
  }))

export type NoteFormValues = z.input<typeof noteSchema>
export type NotePayload = z.output<typeof noteSchema>
