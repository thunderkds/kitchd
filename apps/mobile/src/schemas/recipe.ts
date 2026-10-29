import { z } from 'zod'
import type { RecipeInput } from '../api'
import { isPositiveNumber, requiredText, splitLines, toNumber } from './common'

// CreateRecipeDto: @MinLength(1) name, steps array, optional @IsInt @IsPositive servings, ingredients
// @ArrayMinSize(1) of { ingredientId, @IsPositive qty }. Web RecipeForm drops rows that are not fully
// filled (ingredient chosen AND qty non-blank) before checking that at least one remains.
const rowSchema = z.object({ ingredientId: z.string(), qty: z.string() })

const isComplete = (row: { ingredientId: string; qty: string }) => row.ingredientId !== '' && row.qty.trim() !== ''

export const recipeSchema = z
  .object({
    name: requiredText('Recipe name is required'),
    servings: z.string().refine((text) => {
      if (text.trim() === '') return true
      const value = toNumber(text)
      return Number.isInteger(value) && value > 0
    }, 'Servings must be a whole number greater than 0'),
    steps: z.string(),
    rows: z.array(rowSchema),
  })
  // Row rules live in a refinement (not in the transform) so they are reported together with the
  // name/servings errors instead of being hidden until those are fixed.
  .superRefine((value, ctx) => {
    const complete = value.rows.map((row, index) => ({ row, index })).filter(({ row }) => isComplete(row))

    if (complete.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Add at least one ingredient', path: ['rows'] })
      return
    }

    for (const { row, index } of complete) {
      if (!isPositiveNumber(row.qty)) {
        ctx.addIssue({ code: 'custom', message: 'Quantity must be greater than 0', path: ['rows', index, 'qty'] })
      }
    }
  })
  .transform(
    (value): RecipeInput => ({
      name: value.name,
      steps: splitLines(value.steps),
      servings: value.servings.trim() === '' ? undefined : toNumber(value.servings),
      ingredients: value.rows
        .filter(isComplete)
        .map((row) => ({ ingredientId: row.ingredientId, qty: toNumber(row.qty) })),
    }),
  )

export type RecipeFormValues = z.input<typeof recipeSchema>
export type RecipeRowValues = RecipeFormValues['rows'][number]
