import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { StoredUser } from '@kitchenos/shared'
import GuidelinesScreen from '../app/guidelines'
import InventoryScreen from '../app/inventory'
import NotesScreen from '../app/notes'
import RecipesScreen from '../app/recipes'
import TasksScreen from '../app/tasks'
import TaskDetailScreen from '../app/task/[taskId]'
import * as api from './api'
import { createQueryClient } from './queryClient'

// M018: the six group-A screens take their colours from the active palette (pattern: announcementsTheme.test.tsx).

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
let mockUser: StoredUser | null = null

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ taskId: 'task-1' }),
}))
jest.mock('./session', () => ({
  session: {
    getUser: () => mockUser,
    setUser: (user: StoredUser) => {
      mockUser = user
    },
    getToken: () => 'token-A',
  },
}))
jest.mock('./api', () => ({
  listTasks: jest.fn(),
  getTask: jest.fn(),
  listRecipes: jest.fn(),
  getRecipe: jest.fn(),
  listRecipeVersions: jest.fn(),
  listGuidelines: jest.fn(),
  getGuideline: jest.fn(),
  listIngredients: jest.fn(),
  listMovements: jest.fn(),
  listNotes: jest.fn(),
  listComments: jest.fn(),
  fetchAssignableUsers: jest.fn(),
  currentStockFromMovements: () => 0,
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []
const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean))

const task = {
  id: 'task-1',
  kitchenId: 'k',
  title: 'Prep stock',
  status: 'IN_PROGRESS',
  assigneeId: 'u1',
  dueAt: null,
  checklistItems: [],
  sourceRecipeId: null,
  sourceGuidelineId: null,
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
} as api.Task

beforeEach(() => {
  mocked.listTasks.mockResolvedValue([])
  mocked.getTask.mockResolvedValue(task)
  mocked.listRecipes.mockResolvedValue([])
  mocked.listRecipeVersions.mockResolvedValue([])
  mocked.listGuidelines.mockResolvedValue([])
  mocked.listIngredients.mockResolvedValue([])
  mocked.listMovements.mockResolvedValue([])
  mocked.listNotes.mockResolvedValue([])
  mocked.listComments.mockResolvedValue([])
  mocked.fetchAssignableUsers.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

/** First ancestor (or the node itself) that paints a background: the Pressable behind a button label. */
function backgroundBehind(label: string): string | undefined {
  let node: ReturnType<typeof screen.getByText> | null = screen.getByText(label)
  while (node) {
    const { backgroundColor } = flat(node.props.style)
    if (backgroundColor) return backgroundColor
    node = node.parent
  }
  return undefined
}

const SCREENS: [string, () => ReactElement, string][] = [
  ['tasks', () => <TasksScreen />, 'New task'],
  ['task detail', () => <TaskDetailScreen />, 'Move to Done'],
  ['recipes', () => <RecipesScreen />, 'New recipe'],
  ['guidelines', () => <GuidelinesScreen />, 'New guideline'],
  ['notes', () => <NotesScreen />, 'New note'],
  ['inventory', () => <InventoryScreen />, 'Add ingredient'],
]

const PALETTE_CASES = [
  // Simple is the identity: the exact colours the screens hard-coded before M018 (AC3).
  ['simple', '#0d1016', '#86a0ff', '#6b8cff'],
  ['dark-neon', '#0d1016', '#ff6b8b', '#d51944'],
] as const

describe.each(SCREENS)('%s screen palette (M018)', (_name, element, buttonLabel) => {
  it.each(PALETTE_CASES)('uses the %s palette: background %s, kicker %s, primary button %s', async (themePreference, background, kicker, accent) => {
    mockUser = { id: 'u1', email: 'a@b.c', organizationId: 'o', kitchenId: 'k', role: 'CHEF', themePreference }
    const client = createQueryClient()
    clients.push(client)
    render(<QueryClientProvider client={client}>{element()}</QueryClientProvider>)

    await screen.findByText(buttonLabel)
    expect(flat(screen.UNSAFE_getAllByType(SafeAreaView)[0].props.style).backgroundColor).toBe(background)
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
    expect(backgroundBehind(buttonLabel)).toBe(accent)
  })
})
