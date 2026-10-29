import { z } from 'zod'
import { requiredText } from './common'

// CreateAnnouncementDto: @MinLength(1) title and body. Web requires both non-blank after trim.
export const announcementSchema = z.object({
  title: requiredText('Title is required'),
  body: requiredText('Message is required'),
})

export type AnnouncementFormValues = z.input<typeof announcementSchema>
export type AnnouncementPayload = z.output<typeof announcementSchema>
