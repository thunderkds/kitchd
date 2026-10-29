import { z } from 'zod'
import type { CreateIngredientInput, UpdateIngredientInput } from '../api'
import { isPositiveNumber, requiredText, toNumber } from './common'

// CreateIngredientDto / UpdateIngredientDto: @MinLength(1) name and unit, @IsPositive costPerUnit,
// optional @IsNumber minThreshold. Web IngredientFormDialog (T041/T049) adds the threshold rules:
//   blank -> no key on create, explicit null on edit (an absent key is dropped by JSON.stringify and
//   the stored threshold would silently persist);
//   0, negative or non-numeric -> rejected. `Number('')` is 0 and the alert service filters `gt: 0`,
//   so a stored 0 is invisible to low-stock alerting, exactly like null.
export const THRESHOLD_MESSAGE = 'Low stock threshold must be a number greater than 0 — leave it blank for no threshold'
const COST_MESSAGE = 'Cost per unit must be a number greater than 0'

const ingredientFields = z.object({
  name: requiredText('Name is required'),
  unit: requiredText('Unit is required'),
  costPerUnit: z.string().refine(isPositiveNumber, COST_MESSAGE),
  category: z.string().trim(),
  minThreshold: z.string().refine((text) => text.trim() === '' || isPositiveNumber(text), THRESHOLD_MESSAGE),
})

type IngredientFields = z.output<typeof ingredientFields>

function baseFields(value: IngredientFields) {
  return {
    name: value.name,
    unit: value.unit,
    costPerUnit: toNumber(value.costPerUnit),
    ...(value.category ? { category: value.category } : {}),
  }
}

// Both modes yield a fully populated payload (name, unit and cost are required in edit too, the DTO
// rejects an empty name), so one type fits create and update.
export type IngredientPayload = CreateIngredientInput & UpdateIngredientInput

const ingredientCreateSchema = ingredientFields.transform(
  (value): IngredientPayload => ({
    ...baseFields(value),
    ...(value.minThreshold.trim() === '' ? {} : { minThreshold: toNumber(value.minThreshold) }),
  }),
)

const ingredientEditSchema = ingredientFields.transform(
  (value): IngredientPayload => ({
    ...baseFields(value),
    minThreshold: value.minThreshold.trim() === '' ? null : toNumber(value.minThreshold),
  }),
)

export function ingredientSchema(mode: 'create' | 'edit') {
  return mode === 'edit' ? ingredientEditSchema : ingredientCreateSchema
}

export type IngredientFormValues = z.input<typeof ingredientFields>

// ReceiveStockDto: @IsPositive qty (expiryDate and location are optional and not on the mobile form).
export const receiveStockSchema = z
  .object({ qty: z.string().refine(isPositiveNumber, 'Enter a quantity greater than zero') })
  .transform((value) => ({ qty: toNumber(value.qty) }))

export type ReceiveStockFormValues = z.input<typeof receiveStockSchema>
