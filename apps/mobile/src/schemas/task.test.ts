import { createTaskSchema } from './task'

const issues = (input: unknown) => {
  const result = createTaskSchema.safeParse(input)
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

const base = { mode: 'plain', title: '', dueDate: '', assigneeId: '', recipeId: '', guidelineId: '' }

describe('createTaskSchema (CreateTaskDto; web CreateTaskDialog: title required / recipe / guideline selection)', () => {
  it('plain: outputs just the title when nothing else is set', () => {
    const result = createTaskSchema.safeParse({ ...base, title: '  Prep onions ' })
    expect(result.data).toEqual({ mode: 'plain', input: { title: 'Prep onions' } })
  })

  it('plain: includes assigneeId and an ISO dueAt when given', () => {
    const result = createTaskSchema.safeParse({ ...base, title: 'T', assigneeId: 'u1', dueDate: '2026-11-03' })
    expect(result.success).toBe(true)
    const data = result.data as { input: { assigneeId?: string; dueAt?: string } }
    expect(data.input.assigneeId).toBe('u1')
    expect(new Date(data.input.dueAt as string).getTime()).toBe(new Date('2026-11-03T00:00:00').getTime())
  })

  it('plain: rejects a blank title with the web message', () => {
    expect(issues({ ...base, title: '   ' })).toEqual({ title: 'Title is required' })
  })

  it.each(['11/03/2026', '2026-1-3', 'tomorrow', '2026-02-31', '2026-13-01'])('plain: rejects due date %p', (dueDate) => {
    expect(issues({ ...base, title: 'T', dueDate })).toEqual({ dueDate: 'Due date must be a valid YYYY-MM-DD date' })
  })

  it('plain: reports a blank title and a bad due date together', () => {
    expect(issues({ ...base, title: ' ', dueDate: 'tomorrow' })).toEqual({
      title: 'Title is required',
      dueDate: 'Due date must be a valid YYYY-MM-DD date',
    })
  })

  it('recipe: requires a selection and ignores the plain fields', () => {
    expect(issues({ ...base, mode: 'recipe' })).toEqual({ recipeId: 'Select a recipe' })
    expect(createTaskSchema.safeParse({ ...base, mode: 'recipe', recipeId: 'r1' }).data).toEqual({
      mode: 'recipe',
      recipeId: 'r1',
    })
  })

  it('guideline: requires a selection and ignores the plain fields', () => {
    expect(issues({ ...base, mode: 'guideline' })).toEqual({ guidelineId: 'Select a guideline' })
    expect(createTaskSchema.safeParse({ ...base, mode: 'guideline', guidelineId: 'g1' }).data).toEqual({
      mode: 'guideline',
      guidelineId: 'g1',
    })
  })
})
