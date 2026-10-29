import { announcementSchema } from './announcement'
import { guidelineSchema } from './guideline'
import { noteSchema } from './note'

const issues = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown) => {
  const result = schema.safeParse(input)
  return result.success ? {} : Object.fromEntries((result.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]))
}

describe('guidelineSchema (CreateGuidelineDto; web GuidelineFormDialog)', () => {
  it('trims the title and splits steps', () => {
    expect(guidelineSchema.safeParse({ title: ' Open ', type: 'SOP', steps: 'a\n b \n\n' }).data).toEqual({
      title: 'Open',
      type: 'SOP',
      steps: ['a', 'b'],
    })
  })

  it('accepts empty steps (draft guideline)', () => {
    expect(guidelineSchema.safeParse({ title: 'T', type: 'CHECKLIST', steps: '' }).data).toMatchObject({ steps: [] })
  })

  it('rejects a blank title', () => {
    expect(issues(guidelineSchema, { title: '  ', type: 'SOP', steps: '' })).toEqual({ title: 'Guideline title is required' })
  })

  it('rejects an unknown type', () => {
    expect(guidelineSchema.safeParse({ title: 'T', type: 'OTHER', steps: '' }).success).toBe(false)
  })
})

describe('noteSchema (CreateNoteDto; web NotesPage)', () => {
  it('trims, omits a blank title and splits tags on commas', () => {
    const result = noteSchema.safeParse({ title: ' ', body: ' hello ', tags: ' a, b ,, c ' })
    expect(result.data).toEqual({ title: undefined, body: 'hello', tags: ['a', 'b', 'c'] })
  })

  it('keeps a title', () => {
    expect(noteSchema.safeParse({ title: ' T ', body: 'b', tags: '' }).data).toEqual({ title: 'T', body: 'b', tags: [] })
  })

  it('rejects a blank body', () => {
    expect(issues(noteSchema, { title: '', body: '   ', tags: '' })).toEqual({ body: 'Note body is required' })
  })

  it('rejects more than 50 tags (DTO @ArrayMaxSize(50))', () => {
    const tags = Array.from({ length: 51 }, (_, i) => `t${i}`).join(',')
    expect(issues(noteSchema, { title: '', body: 'b', tags })).toEqual({ tags: 'A note can have at most 50 tags' })
    const fifty = Array.from({ length: 50 }, (_, i) => `t${i}`).join(',')
    expect(noteSchema.safeParse({ title: '', body: 'b', tags: fifty }).success).toBe(true)
  })
})

describe('announcementSchema (CreateAnnouncementDto; web AnnouncementsPage)', () => {
  it('trims title and body', () => {
    expect(announcementSchema.safeParse({ title: ' T ', body: ' B ' }).data).toEqual({ title: 'T', body: 'B' })
  })

  it('rejects a blank title and a blank message independently', () => {
    expect(issues(announcementSchema, { title: ' ', body: 'b' })).toEqual({ title: 'Title is required' })
    expect(issues(announcementSchema, { title: 't', body: '' })).toEqual({ body: 'Message is required' })
    expect(issues(announcementSchema, { title: '', body: '' })).toEqual({
      title: 'Title is required',
      body: 'Message is required',
    })
  })
})
