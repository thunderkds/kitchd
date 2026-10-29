import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import RecipesScreen from '../app/recipes'
import * as api from './api'
import { createQueryClient } from './queryClient'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: { getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }) },
}))
jest.mock('./api', () => ({
  listRecipes: jest.fn(),
  getRecipe: jest.fn(),
  createRecipe: jest.fn(),
  updateRecipe: jest.fn(),
  listIngredients: jest.fn(),
  listRecipeVersions: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function renderScreen() {
  const client = createQueryClient()
  // A settled mutation schedules a 5-minute gc timer on unmount that client.clear() does not
  // cancel, which keeps the jest worker alive. Infinity schedules none.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <RecipesScreen />
    </QueryClientProvider>,
  )
}

const line: api.RecipeIngredientResolved = {
  ingredientId: 'ing-1',
  name: 'Onion',
  unit: 'kg',
  qty: 2,
  costPerUnit: 1.5,
  lineCost: 3,
}

const recipe = (over: Partial<api.Recipe> = {}): api.Recipe => ({
  id: 'rec-1',
  kitchenId: 'k1',
  name: 'Onion soup',
  steps: ['Chop', 'Simmer'],
  servings: 4,
  version: 1,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  ingredients: [line],
  costComputed: 3,
  ...over,
})

const version = (over: Partial<api.RecipeVersion> = {}): api.RecipeVersion => ({
  id: 'ver-1',
  recipeId: 'rec-1',
  version: 1,
  name: 'Onion soup',
  steps: ['Chop', 'Simmer'],
  servings: 4,
  ingredientsSnapshot: [line],
  costComputedAtSnapshot: 3,
  createdAt: '2026-10-01T12:00:00.000Z',
  ...over,
})

beforeEach(() => {
  mocked.listRecipes.mockResolvedValue([recipe()])
  mocked.getRecipe.mockResolvedValue(recipe())
  mocked.listIngredients.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
  mockRouter.replace.mockReset()
})

async function openDetail() {
  renderScreen()
  fireEvent.press(await screen.findByText('Onion soup'))
  await screen.findByText('Recipe version history')
}

describe('Recipe version history (M016)', () => {
  it('AC1: lists versions from GET /recipes/:id/versions with number, date, servings, cost, counts', async () => {
    mocked.listRecipeVersions.mockResolvedValue([
      version({
        id: 'ver-2',
        version: 2,
        servings: 6,
        steps: ['Chop', 'Simmer', 'Serve'],
        ingredientsSnapshot: [line, { ...line, ingredientId: 'ing-2', name: 'Stock' }],
        costComputedAtSnapshot: 7.5,
        createdAt: '2026-10-05T12:00:00.000Z',
      }),
      version(),
    ])
    await openDetail()

    expect(await screen.findByText('Version 2 · Oct 5, 2026')).toBeTruthy()
    expect(screen.getByText('Version 1 · Oct 1, 2026')).toBeTruthy()
    expect(screen.getByText('6 servings · Cost snapshot: 7.50')).toBeTruthy()
    expect(screen.getByText('3 steps · 2 ingredients')).toBeTruthy()
    expect(screen.getByText('4 servings · Cost snapshot: 3.00')).toBeTruthy()
    expect(mocked.listRecipeVersions).toHaveBeenCalledWith('rec-1')
  })

  it('shows a loading line, then the empty state when there are no versions', async () => {
    let release: (value: api.RecipeVersion[]) => void = () => {}
    mocked.listRecipeVersions.mockReturnValue(new Promise((resolve) => (release = resolve)))
    await openDetail()

    expect(screen.getByText('Loading version history...')).toBeTruthy()
    release([])
    expect(await screen.findByText('No saved versions yet.')).toBeTruthy()
    expect(screen.queryByText('Loading version history...')).toBeNull()
  })

  it('shows the API error message when the versions request fails', async () => {
    mocked.listRecipeVersions.mockRejectedValue(Object.assign(new Error('Recipe not found'), { status: 404 }))
    await openDetail()

    expect(await screen.findByText('Recipe not found')).toBeTruthy()
    expect(screen.queryByText('No saved versions yet.')).toBeNull()
  })

  it('AC2: editing a recipe invalidates the versions query so the new version appears', async () => {
    mocked.listRecipeVersions
      .mockResolvedValueOnce([version()])
      .mockResolvedValue([version({ id: 'ver-2', version: 2, createdAt: '2026-10-06T12:00:00.000Z' }), version()])
    mocked.updateRecipe.mockResolvedValue(recipe({ version: 2 }))
    await openDetail()
    expect(await screen.findByText('Version 1 · Oct 1, 2026')).toBeTruthy()
    expect(screen.queryByText('Version 2 · Oct 6, 2026')).toBeNull()

    fireEvent.press(screen.getByText('Edit recipe'))
    fireEvent.press(await screen.findByText('Save recipe'))

    await waitFor(() => expect(mocked.updateRecipe).toHaveBeenCalledWith('rec-1', expect.any(Object)))
    expect(await screen.findByText('Version 2 · Oct 6, 2026')).toBeTruthy()
    expect(mocked.listRecipeVersions).toHaveBeenCalledTimes(2)
  })
})
