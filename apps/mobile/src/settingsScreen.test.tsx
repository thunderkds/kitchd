import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { StoredUser } from '@kitchenos/shared'
import SettingsScreen from '../app/settings'
import * as api from './api'
import { createQueryClient } from './queryClient'
import { ThemeContext, createThemeStore } from './theme'
import { expectSafeAreaAndKeyboardAvoidance } from './testing/nativeFrame'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
let mockUser: StoredUser | null = null

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: {
    getUser: () => mockUser,
    setUser: (user: StoredUser) => {
      mockUser = user
    },
  },
}))
jest.mock('./api', () => ({
  getKitchen: jest.fn(),
  renameKitchen: jest.fn(),
  updateTheme: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

const userWith = (role: StoredUser['role'], themePreference?: StoredUser['themePreference']): StoredUser => ({
  id: 'u1',
  email: 'u1@example.com',
  organizationId: 'org-1',
  kitchenId: 'k1',
  role,
  ...(themePreference ? { themePreference } : {}),
})

function renderScreen() {
  const client = createQueryClient()
  // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  const store = createThemeStore()
  const view = render(
    <ThemeContext.Provider value={store}>
      <QueryClientProvider client={client}>
        <SettingsScreen />
      </QueryClientProvider>
    </ThemeContext.Provider>,
  )
  return { client, store, ...view }
}

// A CHEF sees the name in an editable field; wait until it is filled from the query.
async function kitchenNameInput() {
  const input = await screen.findByPlaceholderText('Kitchen name')
  await waitFor(() => expect(screen.getByPlaceholderText('Kitchen name').props.value).toBe('Main Kitchen'))
  return input
}

const selected = (label: string) =>
  screen.getByRole('radio', { name: label }).props.accessibilityState?.selected

beforeEach(() => {
  mockUser = userWith('CHEF', 'simple')
  mocked.getKitchen.mockResolvedValue({ id: 'k1', name: 'Main Kitchen' })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
  mockRouter.replace.mockReset()
})

describe('SettingsScreen theme (M006 AC2)', () => {
  it('shows the stored preference as selected', async () => {
    mockUser = userWith('CHEF', 'dark-neon')
    renderScreen()

    expect(selected('Graphite Mint')).toBe(true)
    expect(selected('Simple')).toBe(false)
    await kitchenNameInput()
  })

  it('on success calls updateTheme, updates the stored user and re-renders with the new palette', async () => {
    mocked.updateTheme.mockResolvedValue({ id: 'u1', email: 'u1@example.com', themePreference: 'dark_neon' })
    renderScreen()
    await kitchenNameInput()
    const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean))
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe('#86a0ff')

    fireEvent.press(screen.getByRole('radio', { name: 'Graphite Mint' }))

    await waitFor(() => expect(selected('Graphite Mint')).toBe(true))
    expect(mocked.updateTheme).toHaveBeenCalledWith('dark-neon')
    expect(mockUser?.themePreference).toBe('dark-neon')
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe('#7EDDB0')
  })

  it.each([
    ['simple', '#ffffff'],
    ['dark-neon', '#0E100F'],
  ] as const)('%s: the text on the Save name button is %s (M022 AC2)', async (themePreference, text) => {
    mockUser = userWith('CHEF', themePreference)
    renderScreen()
    await kitchenNameInput()

    const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean))
    expect(flat(screen.getByText('Save name').props.style).color).toBe(text)
  })

  it('on failure shows the error and keeps the old value', async () => {
    mocked.updateTheme.mockRejectedValue(new Error('Theme service down'))
    renderScreen()
    await kitchenNameInput()

    fireEvent.press(screen.getByRole('radio', { name: 'Graphite Mint' }))

    expect(await screen.findByText('Theme service down')).toBeTruthy()
    expect(selected('Simple')).toBe(true)
    expect(selected('Graphite Mint')).toBe(false)
    expect(mockUser?.themePreference).toBe('simple')
  })
})

describe('SettingsScreen kitchen (M006 AC4)', () => {
  it('loads the kitchen name from GET /kitchens/:id (read-only text for non-CHEF, field for CHEF)', async () => {
    mockUser = userWith('STAFF', 'simple')
    renderScreen()

    expect(await screen.findByText('Main Kitchen')).toBeTruthy()
    expect(mocked.getKitchen).toHaveBeenCalledWith('k1')
  })

  it('fills the CHEF rename field with the loaded name', async () => {
    renderScreen()

    await kitchenNameInput()
    expect(mocked.getKitchen).toHaveBeenCalledWith('k1')
  })

  it.each(['OWNER', 'ADMIN', 'STAFF', 'VIEWER'] as const)('hides the rename control for %s', async (role) => {
    mockUser = userWith(role, 'simple')
    renderScreen()

    expect(await screen.findByText('Main Kitchen')).toBeTruthy()
    expect(screen.queryByPlaceholderText('Kitchen name')).toBeNull()
    expect(screen.queryByText('Save name')).toBeNull()
  })

  it('lets a CHEF rename, then invalidates the kitchen query so the new name is refetched', async () => {
    mocked.getKitchen
      .mockResolvedValueOnce({ id: 'k1', name: 'Main Kitchen' })
      .mockResolvedValue({ id: 'k1', name: 'Rooftop Kitchen' })
    mocked.renameKitchen.mockResolvedValue({ id: 'k1', name: 'Rooftop Kitchen' })
    renderScreen()

    const input = await screen.findByPlaceholderText('Kitchen name')
    await waitFor(() => expect(input.props.value).toBe('Main Kitchen'))
    fireEvent.changeText(input, '  Rooftop Kitchen  ')
    fireEvent.press(screen.getByText('Save name'))

    await waitFor(() => expect(mocked.renameKitchen).toHaveBeenCalledWith('k1', 'Rooftop Kitchen'))
    await waitFor(() => expect(mocked.getKitchen).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByPlaceholderText('Kitchen name').props.value).toBe('Rooftop Kitchen'))
  })

  it('rejects an empty name without calling the API', async () => {
    renderScreen()

    const input = await screen.findByPlaceholderText('Kitchen name')
    await waitFor(() => expect(input.props.value).toBe('Main Kitchen'))
    fireEvent.changeText(input, '   ')
    fireEvent.press(screen.getByText('Save name'))

    expect(await screen.findByText('Kitchen name is required.')).toBeTruthy()
    expect(mocked.renameKitchen).not.toHaveBeenCalled()
  })

  it('shows the API error when the rename fails', async () => {
    mocked.renameKitchen.mockRejectedValue(new Error('Forbidden resource'))
    renderScreen()

    const input = await screen.findByPlaceholderText('Kitchen name')
    await waitFor(() => expect(input.props.value).toBe('Main Kitchen'))
    fireEvent.changeText(input, 'Other')
    fireEvent.press(screen.getByText('Save name'))

    expect(await screen.findByText('Forbidden resource')).toBeTruthy()
  })
})

describe('SettingsScreen native quality (M010)', () => {
  it('AC2 + AC3: sits in the safe area and avoids the keyboard', async () => {
    mockUser = userWith('CHEF', 'simple')
    mocked.getKitchen.mockResolvedValue({ id: 'k1', name: 'Main Kitchen' } as api.Kitchen)
    renderScreen()

    await kitchenNameInput()
    expectSafeAreaAndKeyboardAvoidance()
  })
})
