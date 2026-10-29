import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import InventoryScreen from '../app/inventory'
import * as api from './api'
import { createQueryClient } from './queryClient'
import { queryKeys } from './queryKeys'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: {
    getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }),
    getToken: () => 'token-A',
  },
}))
jest.mock('./api', () => ({
  listIngredients: jest.fn(),
  listMovements: jest.fn(),
  createIngredient: jest.fn(),
  updateIngredient: jest.fn(),
  receiveStock: jest.fn(),
  currentStockFromMovements: (movements: { qty: number }[]) => movements.reduce((sum, m) => sum + m.qty, 0),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function renderScreen() {
  const client = createQueryClient()
  // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  const view = render(
    <QueryClientProvider client={client}>
      <InventoryScreen />
    </QueryClientProvider>,
  )
  return { ...view, client }
}

const ingredient: api.Ingredient = {
  id: 'ing-1',
  name: 'Onion',
  unit: 'kg',
  costPerUnit: 2,
  category: null,
  allergens: [],
  supplierId: null,
  minThreshold: 5,
}

// The dashboard alert widgets cache under alerts.*; a stock or threshold write must mark them stale.
function seedAlerts(client: ReturnType<typeof createQueryClient>) {
  client.setQueryData(queryKeys.alerts.lowStock(), [])
  client.setQueryData(queryKeys.alerts.expiring(), [])
}

const isStale = (client: ReturnType<typeof createQueryClient>, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated === true

beforeEach(() => {
  mocked.listIngredients.mockResolvedValue([ingredient])
  mocked.listMovements.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
})

describe('InventoryScreen writes refresh the dashboard alert widgets (M015 follow-up)', () => {
  it('receiving stock invalidates alerts.*', async () => {
    mocked.receiveStock.mockResolvedValue({} as never)
    const { client } = renderScreen()
    seedAlerts(client)

    fireEvent.press(await screen.findByText('Receive stock'))
    fireEvent.changeText(screen.getByPlaceholderText('Receive qty'), '3')
    fireEvent.press(screen.getByText('Confirm'))

    await waitFor(() => expect(mocked.receiveStock).toHaveBeenCalledWith('ing-1', { qty: 3 }))
    await waitFor(() => expect(isStale(client, queryKeys.alerts.lowStock())).toBe(true))
    expect(isStale(client, queryKeys.alerts.expiring())).toBe(true)
  })

  it('updating an ingredient threshold invalidates alerts.*', async () => {
    mocked.updateIngredient.mockResolvedValue(ingredient)
    const { client } = renderScreen()
    seedAlerts(client)

    fireEvent.press(await screen.findByText('Edit'))
    fireEvent.changeText(screen.getByPlaceholderText('Low-stock threshold'), '9')
    fireEvent.press(screen.getByText('Save ingredient'))

    await waitFor(() => expect(mocked.updateIngredient).toHaveBeenCalled())
    await waitFor(() => expect(isStale(client, queryKeys.alerts.lowStock())).toBe(true))
    expect(isStale(client, queryKeys.alerts.expiring())).toBe(true)
  })

  it('creating an ingredient with a threshold invalidates alerts.*', async () => {
    mocked.createIngredient.mockResolvedValue(ingredient)
    const { client } = renderScreen()
    seedAlerts(client)

    fireEvent.press(await screen.findByText('Add ingredient'))
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Garlic')
    fireEvent.changeText(screen.getByPlaceholderText('Unit'), 'kg')
    fireEvent.changeText(screen.getByPlaceholderText('Cost per unit'), '4')
    fireEvent.changeText(screen.getByPlaceholderText('Low-stock threshold'), '2')
    fireEvent.press(screen.getByText('Save ingredient'))

    await waitFor(() => expect(mocked.createIngredient).toHaveBeenCalled())
    await waitFor(() => expect(isStale(client, queryKeys.alerts.lowStock())).toBe(true))
  })
})
