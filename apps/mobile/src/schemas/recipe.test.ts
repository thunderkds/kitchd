import { recipeSchema } from './recipe'

const row = (ingredientId: string, qty: string) => ({ ingredientId, qty })
const base = { name: ' Soup ', servings: '', steps: ' chop \n\n boil ', rows: [row('i1', '2')] }

const issues = (input: unknown) => {
  const result = recipeSchema.safeParse(input)
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('recipeSchema (CreateRecipeDto / RecipeIngredientInputDto; web RecipeForm)', () => {
  it('outputs trimmed name, split steps, no servings, numeric qty', () => {
    const result = recipeSchema.safeParse(base)
    expect(result.data).toEqual({
      name: 'Soup',
      steps: ['chop', 'boil'],
      servings: undefined,
      ingredients: [{ ingredientId: 'i1', qty: 2 }],
    })
  })

  it('accepts a positive integer servings', () => {
    expect(recipeSchema.safeParse({ ...base, servings: ' 4 ' }).data).toMatchObject({ servings: 4 })
  })

  it.each(['0', '-2', '2.5', 'abc'])('rejects servings %p (DTO @IsInt @IsPositive)', (servings) => {
    expect(issues({ ...base, servings })).toEqual({ servings: 'Servings must be a whole number greater than 0' })
  })

  it('reports row errors together with name and servings errors (all at once)', () => {
    expect(issues({ name: '', servings: '1.5', steps: '', rows: [row('i1', '0')] })).toEqual({
      name: 'Recipe name is required',
      servings: 'Servings must be a whole number greater than 0',
      'rows.0.qty': 'Quantity must be greater than 0',
    })
    expect(issues({ name: '', servings: '', steps: '', rows: [row('', '')] })).toEqual({
      name: 'Recipe name is required',
      rows: 'Add at least one ingredient',
    })
  })

  it('rejects a blank name', () => {
    expect(issues({ ...base, name: '   ' })).toEqual({ name: 'Recipe name is required' })
  })

  it('allows empty steps (DTO accepts an empty array)', () => {
    expect(recipeSchema.safeParse({ ...base, steps: '' }).data).toMatchObject({ steps: [] })
  })

  it('requires at least one complete ingredient row (ArrayMinSize(1))', () => {
    expect(issues({ ...base, rows: [row('', '')] })).toEqual({ rows: 'Add at least one ingredient' })
    expect(issues({ ...base, rows: [row('i1', '')] })).toEqual({ rows: 'Add at least one ingredient' })
    expect(issues({ ...base, rows: [row('', '2')] })).toEqual({ rows: 'Add at least one ingredient' })
  })

  it('drops incomplete rows like web does, keeping the complete ones', () => {
    const result = recipeSchema.safeParse({ ...base, rows: [row('', ''), row('i2', '1.5'), row('i3', '')] })
    expect(result.data).toMatchObject({ ingredients: [{ ingredientId: 'i2', qty: 1.5 }] })
  })

  it.each(['0', '-1', 'abc'])('rejects a complete row with qty %p, on that row', (qty) => {
    expect(issues({ ...base, rows: [row('i1', '1'), row('i2', qty)] })).toEqual({
      'rows.1.qty': 'Quantity must be greater than 0',
    })
  })
})
