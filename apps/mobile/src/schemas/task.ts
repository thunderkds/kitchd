import { z } from 'zod'
import type { CreateTaskInput } from '../api'
import { requiredText } from './common'

// CreateTaskDto: @MinLength(1) title, optional assigneeId, optional @IsDateString dueAt. Web
// CreateTaskDialog: plain mode needs a title, recipe/guideline mode needs a selection.
export type CreateTaskRequest =
  | { mode: 'plain'; input: CreateTaskInput }
  | { mode: 'recipe'; recipeId: string }
  | { mode: 'guideline'; guidelineId: string }

const DATE_MESSAGE = 'Due date must be a valid YYYY-MM-DD date'

/** Local midnight of a real calendar date as an ISO string (the screen always sent it this way), or null. */
function isoFromDateInput(text: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date.toISOString()
}

export const createTaskSchema = z
  .object({
    mode: z.enum(['plain', 'recipe', 'guideline']),
    title: z.string(),
    dueDate: z.string(),
    assigneeId: z.string(),
    recipeId: z.string(),
    guidelineId: z.string(),
  })
  .transform((value, ctx): CreateTaskRequest => {
    // Collect every failing field so the user sees them all at once, not one per submit.
    let failed = false
    const fail = (path: string, message: string, input: unknown) => {
      ctx.issues.push({ code: 'custom', message, path: [path], input })
      failed = true
    }

    if (value.mode === 'recipe') {
      if (value.recipeId) return { mode: 'recipe', recipeId: value.recipeId }
      fail('recipeId', 'Select a recipe', value.recipeId)
      return z.NEVER
    }
    if (value.mode === 'guideline') {
      if (value.guidelineId) return { mode: 'guideline', guidelineId: value.guidelineId }
      fail('guidelineId', 'Select a guideline', value.guidelineId)
      return z.NEVER
    }

    const title = requiredText('Title is required').safeParse(value.title)
    if (!title.success) fail('title', 'Title is required', value.title)

    const dueText = value.dueDate.trim()
    const dueAt = dueText === '' ? null : isoFromDateInput(dueText)
    if (dueText !== '' && dueAt === null) fail('dueDate', DATE_MESSAGE, value.dueDate)

    if (failed || !title.success) return z.NEVER

    const assigneeId = value.assigneeId.trim()
    return {
      mode: 'plain',
      input: {
        title: title.data,
        ...(assigneeId ? { assigneeId } : {}),
        ...(dueAt ? { dueAt } : {}),
      },
    }
  })

export type CreateTaskFormValues = z.input<typeof createTaskSchema>
