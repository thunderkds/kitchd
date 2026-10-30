import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import GuidelinesScreen from '../app/guidelines'
import RecipesScreen from '../app/recipes'
import * as api from './api'
import { createQueryClient } from './queryClient'

// M005 review: the recipe form's useFieldArray rows and the edit prefill, which forms.test.tsx only
// touches on the create path with a single row.

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: { getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }), getToken: () => 'token-A' },
}))
jest.mock('./api', () => ({
  listRecipes: jest.fn(),
  getRecipe: jest.fn(),
  createRecipe: jest.fn(),
  updateRecipe: jest.fn(),
  listIngredients: jest.fn(),
  listRecipeVersions: jest.fn(),
  listGuidelines: jest.fn(),
  getGuideline: jest.fn(),
  updateGuideline: jest.fn(),
  createGuideline: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function renderScreen(ui: React.ReactElement) {
  const client = createQueryClient()
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const ingredient = (id: string, name: string): api.Ingredient => ({
  id,
  name,
  unit: 'kg',
  costPerUnit: 1,
  category: null,
  allergens: [],
  supplierId: null,
  minThreshold: null,
})

const recipe: api.Recipe = {
  id: 'rec-1',
  kitchenId: 'k1',
  name: 'Onion soup',
  steps: ['Chop', 'Simmer'],
  servings: 4,
  version: 1,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  ingredients: [{ ingredientId: 'ing-1', name: 'Onion', unit: 'kg', qty: 2, costPerUnit: 1, lineCost: 2 }],
  costComputed: 2,
}

const guideline: api.Guideline = {
  id: 'g-1',
  kitchenId: 'k1',
  title: 'Opening',
  type: 'CHECKLIST',
  steps: ['Unlock', 'Lights'],
  attachments: [],
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
} as api.Guideline

const firstArg = (fn: unknown) => (fn as jest.Mock).mock.calls[0][0]

beforeEach(() => {
  mocked.listRecipes.mockResolvedValue([recipe])
  mocked.getRecipe.mockResolvedValue(recipe)
  mocked.listIngredients.mockResolvedValue([ingredient('ing-1', 'Onion'), ingredient('ing-2', 'Garlic')])
  mocked.listRecipeVersions.mockResolvedValue([])
  mocked.listGuidelines.mockResolvedValue([guideline])
  mocked.getGuideline.mockResolvedValue(guideline)
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
  mockRouter.replace.mockReset()
})

describe('recipe form field array', () => {
  it('add row, fill row 2, remove row 1, save: the payload holds only the surviving row', async () => {
    mocked.createRecipe.mockResolvedValue(recipe)
    renderScreen(<RecipesScreen />)
    fireEvent.press(await screen.findByText('New recipe'))

    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Stew')
    fireEvent.press(screen.getByText('Choose ingredient'))
    fireEvent.press(screen.getByText('Onion (kg)'))
    fireEvent.changeText(screen.getByPlaceholderText('Quantity'), '1')

    fireEvent.press(screen.getByText('Add row'))
    expect(screen.getAllByPlaceholderText('Quantity')).toHaveLength(2)
    fireEvent.press(screen.getByText('Choose ingredient'))
    fireEvent.press(screen.getByText('Garlic (kg)'))
    fireEvent.changeText(screen.getAllByPlaceholderText('Quantity')[1], '3')

    fireEvent.press(screen.getAllByText('Remove')[0])

    // The surviving row keeps its own values: row 2's qty must not be left behind or shift to another row.
    expect(screen.getAllByPlaceholderText('Quantity')).toHaveLength(1)
    expect(screen.getByPlaceholderText('Quantity').props.value).toBe('3')
    expect(screen.getByText('Garlic (kg)')).toBeTruthy()

    fireEvent.press(screen.getByText('Save recipe'))

    await waitFor(() => expect(mocked.createRecipe).toHaveBeenCalledTimes(1))
    expect(firstArg(mocked.createRecipe)).toEqual({
      name: 'Stew',
      steps: [],
      servings: undefined,
      ingredients: [{ ingredientId: 'ing-2', qty: 3 }],
    })
  })

  it('edit prefills every field from the recipe, and saving sends updateRecipe with the changes', async () => {
    mocked.updateRecipe.mockResolvedValue(recipe)
    renderScreen(<RecipesScreen />)
    fireEvent.press(await screen.findByText('Onion soup'))
    fireEvent.press(await screen.findByText('Edit recipe'))

    expect(screen.getByPlaceholderText('Name').props.value).toBe('Onion soup')
    expect(screen.getByPlaceholderText('Servings').props.value).toBe('4')
    expect(screen.getByPlaceholderText('Steps, one per line').props.value).toBe('Chop\nSimmer')
    expect(screen.getByPlaceholderText('Quantity').props.value).toBe('2')

    fireEvent.changeText(screen.getByPlaceholderText('Servings'), '6')
    fireEvent.press(screen.getByText('Save recipe'))

    await waitFor(() => expect(mocked.updateRecipe).toHaveBeenCalledTimes(1))
    expect(mocked.updateRecipe.mock.calls[0][0]).toBe('rec-1')
    expect(mocked.updateRecipe.mock.calls[0][1]).toEqual({
      name: 'Onion soup',
      steps: ['Chop', 'Simmer'],
      servings: 6,
      ingredients: [{ ingredientId: 'ing-1', qty: 2 }],
    })
    expect(mocked.createRecipe).not.toHaveBeenCalled()
  })

  it('opening New recipe after an edit starts from an empty form', async () => {
    renderScreen(<RecipesScreen />)
    fireEvent.press(await screen.findByText('Onion soup'))
    fireEvent.press(await screen.findByText('Edit recipe'))
    fireEvent.press(screen.getByText('Cancel'))
    fireEvent.press(screen.getByText('Back'))
    fireEvent.press(await screen.findByText('New recipe'))

    expect(screen.getByPlaceholderText('Name').props.value).toBe('')
    expect(screen.getByPlaceholderText('Quantity').props.value).toBe('')
  })
})

describe('guideline form edit', () => {
  it('prefills title, type and steps, and saving sends updateGuideline', async () => {
    mocked.updateGuideline.mockResolvedValue(guideline)
    renderScreen(<GuidelinesScreen />)
    fireEvent.press(await screen.findByText('Opening'))
    fireEvent.press(await screen.findByText('Edit guideline'))
    // M013 AC8: Edit opens the form straight away, no detour through Back.

    expect(await screen.findByDisplayValue('Opening')).toBeTruthy()
    expect(screen.getByPlaceholderText('Steps, one per line').props.value).toBe('Unlock\nLights')

    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Opening v2')
    fireEvent.press(screen.getByText('Save'))

    await waitFor(() => expect(mocked.updateGuideline).toHaveBeenCalledTimes(1))
    expect(mocked.updateGuideline.mock.calls[0][0]).toBe('g-1')
    expect(mocked.updateGuideline.mock.calls[0][1]).toEqual({
      title: 'Opening v2',
      type: 'CHECKLIST',
      steps: ['Unlock', 'Lights'],
    })
  })
})
