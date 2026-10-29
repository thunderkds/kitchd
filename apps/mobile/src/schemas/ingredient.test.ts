import { ingredientSchema, receiveStockSchema } from './ingredient'

const base = { name: ' Onion ', unit: ' kg ', costPerUnit: '2.5', category: '', minThreshold: '' }

const issues = (mode: 'create' | 'edit', input: unknown) => {
  const result = ingredientSchema(mode).safeParse(input)
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

const THRESHOLD_MESSAGE = 'Low stock threshold must be a number greater than 0 — leave it blank for no threshold'

describe('ingredientSchema (CreateIngredientDto / UpdateIngredientDto; web IngredientFormDialog T041/T049)', () => {
  it('create: trims text, parses cost, and OMITS minThreshold (and category) when blank', () => {
    const result = ingredientSchema('create').safeParse(base)
    expect(result.data).toEqual({ name: 'Onion', unit: 'kg', costPerUnit: 2.5 })
    expect(result.data).not.toHaveProperty('minThreshold')
    expect(result.data).not.toHaveProperty('category')
  })

  it('edit: blank minThreshold becomes an explicit null so the stored value is cleared (T049)', () => {
    const result = ingredientSchema('edit').safeParse(base)
    expect(result.data).toEqual({ name: 'Onion', unit: 'kg', costPerUnit: 2.5, minThreshold: null })
    expect(result.data).toHaveProperty('minThreshold', null)
  })

  it.each(['create', 'edit'] as const)('%s: a positive threshold is kept as a number', (mode) => {
    expect(ingredientSchema(mode).safeParse({ ...base, minThreshold: ' 5 ' }).data).toMatchObject({ minThreshold: 5 })
    expect(ingredientSchema(mode).safeParse({ ...base, minThreshold: '0.5' }).data).toMatchObject({ minThreshold: 0.5 })
  })

  it.each(['create', 'edit'] as const)('%s: rejects 0, negative and non-numeric thresholds (T041: 0 is invisible to gt:0 alerts)', (mode) => {
    for (const minThreshold of ['0', '0.0', '-1', '-0.5', 'abc', '5kg', 'NaN', 'Infinity']) {
      expect(issues(mode, { ...base, minThreshold })).toEqual({ minThreshold: THRESHOLD_MESSAGE })
    }
  })

  it('keeps a non-blank category, trimmed', () => {
    expect(ingredientSchema('create').safeParse({ ...base, category: ' Produce ' }).data).toMatchObject({ category: 'Produce' })
  })

  it.each(['create', 'edit'] as const)('%s: requires name, unit and a cost greater than 0 (DTO @MinLength(1) / @IsPositive)', (mode) => {
    expect(issues(mode, { ...base, name: '  ' })).toEqual({ name: 'Name is required' })
    expect(issues(mode, { ...base, unit: '' })).toEqual({ unit: 'Unit is required' })
    for (const costPerUnit of ['', '  ', '0', '-2', 'abc']) {
      expect(Object.keys(issues(mode, { ...base, costPerUnit }))).toEqual(['costPerUnit'])
    }
  })

  it('a blank cost is rejected, not silently sent as 0 (Number("") is 0)', () => {
    expect(issues('create', { ...base, costPerUnit: '' })).toEqual({ costPerUnit: 'Cost per unit must be a number greater than 0' })
  })
})

describe('receiveStockSchema (ReceiveStockDto @IsPositive qty)', () => {
  it('accepts a positive quantity', () => {
    expect(receiveStockSchema.safeParse({ qty: ' 3.5 ' }).data).toEqual({ qty: 3.5 })
  })

  it.each(['', '0', '-1', 'abc'])('rejects %p', (qty) => {
    const result = receiveStockSchema.safeParse({ qty })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Enter a quantity greater than zero')
  })
})
