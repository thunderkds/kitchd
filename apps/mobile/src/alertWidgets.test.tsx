import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native'
import { View } from 'react-native'
import { AlertWidgets, ExpiringSoonWidget, LowStockWidget } from './components/AlertWidgets'
import * as api from './api'
import { createQueryClient } from './queryClient'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./api', () => ({
  listLowStock: jest.fn(),
  listExpiringSoon: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function renderWith(ui: React.ReactElement) {
  const client = createQueryClient()
  clients.push(client)
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean))

// Walk up from a row's label to the Pressable that carries the row background.
function rowBackground(label: string): unknown {
  let node = screen.getByText(label).parent
  while (node && !flat(node.props.style).backgroundColor) node = node.parent
  return flat(node?.props.style).backgroundColor
}

const CRITICAL_BG = 'rgba(255, 99, 99, 0.14)'
const WARNING_BG = 'rgba(255, 193, 77, 0.12)'

const lowStock = (over: Partial<api.LowStockIngredient> = {}): api.LowStockIngredient => ({
  id: 'ing-1',
  name: 'Flour',
  unit: 'kg',
  minThreshold: 10,
  currentStock: 4,
  ...over,
})

const batch = (over: Partial<api.ExpiringSoonBatch> = {}): api.ExpiringSoonBatch => ({
  id: 'batch-1',
  ingredientId: 'ing-2',
  qty: 2,
  expiryDate: '2026-11-02T00:00:00.000Z',
  location: 'Walk-in',
  createdAt: '2026-10-01T00:00:00.000Z',
  ingredient: { id: 'ing-2', name: 'Milk', unit: 'L' },
  ...over,
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  mocked.listLowStock.mockReset()
  mocked.listExpiringSoon.mockReset()
  mockRouter.push.mockReset()
})

describe('LowStockWidget (M015 AC1, AC3, AC5)', () => {
  it('shows loading, then name with current vs threshold', async () => {
    mocked.listLowStock.mockResolvedValue([lowStock()])
    renderWith(<LowStockWidget />)

    expect(screen.getByText('Loading…')).toBeTruthy()
    expect(await screen.findByText('Flour')).toBeTruthy()
    expect(screen.getByText('4 kg (min 10)')).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('styles a row critical at or below half the threshold and warning above it', async () => {
    mocked.listLowStock.mockResolvedValue([
      lowStock({ id: 'a', name: 'Half', currentStock: 5 }),
      lowStock({ id: 'b', name: 'Above half', currentStock: 6 }),
      lowStock({ id: 'c', name: 'Empty', currentStock: 0 }),
    ])
    renderWith(<LowStockWidget />)
    await screen.findByText('Half')

    expect(rowBackground('Half')).toBe(CRITICAL_BG)
    expect(flat(screen.getByText('Half').props.style).color).toBe('#ff8a8a')
    expect(rowBackground('Empty')).toBe(CRITICAL_BG)
    expect(rowBackground('Above half')).toBe(WARNING_BG)
    expect(flat(screen.getByText('Above half').props.style).color).toBe('#ffc14d')
  })

  it('treats a null threshold as a warning, never critical', async () => {
    mocked.listLowStock.mockResolvedValue([lowStock({ minThreshold: null, currentStock: 0 })])
    renderWith(<LowStockWidget />)
    await screen.findByText('Flour')

    expect(rowBackground('Flour')).toBe(WARNING_BG)
  })

  it('shows the empty state', async () => {
    mocked.listLowStock.mockResolvedValue([])
    renderWith(<LowStockWidget />)

    expect(await screen.findByText('All ingredients are above their thresholds.')).toBeTruthy()
  })

  it('shows the error message locally', async () => {
    mocked.listLowStock.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
    renderWith(<LowStockWidget />)

    expect(await screen.findByText('Forbidden')).toBeTruthy()
  })

  it('navigates to /inventory when an item is tapped', async () => {
    mocked.listLowStock.mockResolvedValue([lowStock()])
    renderWith(<LowStockWidget />)

    fireEvent.press(await screen.findByText('Flour'))

    expect(mockRouter.push).toHaveBeenCalledWith('/inventory')
  })
})

describe('ExpiringSoonWidget (M015 AC2, AC3, AC5)', () => {
  it('shows ingredient, location, qty and a formatted expiry date', async () => {
    mocked.listExpiringSoon.mockResolvedValue([batch()])
    renderWith(<ExpiringSoonWidget />)

    expect(screen.getByText('Loading…')).toBeTruthy()
    expect(await screen.findByText('Milk · Walk-in')).toBeTruthy()
    expect(screen.getByText(/^2 L · Nov \d, 2026$/)).toBeTruthy()
  })

  it('omits the location and handles a null expiry date', async () => {
    mocked.listExpiringSoon.mockResolvedValue([batch({ location: null, expiryDate: null })])
    renderWith(<ExpiringSoonWidget />)

    expect(await screen.findByText('Milk')).toBeTruthy()
    expect(screen.getByText('2 L · No expiry date')).toBeTruthy()
  })

  it('shows the empty state', async () => {
    mocked.listExpiringSoon.mockResolvedValue([])
    renderWith(<ExpiringSoonWidget />)

    expect(await screen.findByText('No batches are expiring soon.')).toBeTruthy()
  })

  it('shows the error message locally', async () => {
    mocked.listExpiringSoon.mockRejectedValue(Object.assign(new Error('Boom'), { status: 403 }))
    renderWith(<ExpiringSoonWidget />)

    expect(await screen.findByText('Boom')).toBeTruthy()
  })

  it('calls the API with no explicit window (server default, same as web)', async () => {
    mocked.listExpiringSoon.mockResolvedValue([])
    renderWith(<ExpiringSoonWidget />)
    await screen.findByText('No batches are expiring soon.')

    expect(mocked.listExpiringSoon).toHaveBeenCalledWith()
  })

  it('navigates to /inventory when an item is tapped', async () => {
    mocked.listExpiringSoon.mockResolvedValue([batch()])
    renderWith(<ExpiringSoonWidget />)

    fireEvent.press(await screen.findByText('Milk · Walk-in'))

    expect(mockRouter.push).toHaveBeenCalledWith('/inventory')
  })
})

describe('AlertWidgets (M015 AC4: errors are local)', () => {
  it('keeps the other widget populated when one fails', async () => {
    mocked.listLowStock.mockRejectedValue(Object.assign(new Error('Low stock down'), { status: 403 }))
    mocked.listExpiringSoon.mockResolvedValue([batch()])
    renderWith(
      <View>
        <AlertWidgets />
      </View>,
    )

    expect(await screen.findByText('Low stock down')).toBeTruthy()
    expect(await screen.findByText('Milk · Walk-in')).toBeTruthy()
  })
})
