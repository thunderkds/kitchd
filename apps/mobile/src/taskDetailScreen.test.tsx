import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { ScrollView } from 'react-native'
import TaskDetailScreen from '../app/task/[taskId]'
import * as api from './api'
import { createQueryClient } from './queryClient'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
const mockUser = { id: 'u1', email: 'chef@example.com', role: 'CHEF' }

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ taskId: 'task-1' }),
}))
jest.mock('./session', () => ({ session: { getUser: () => mockUser } }))
jest.mock('./api', () => ({
  getTask: jest.fn(),
  listRecipes: jest.fn(),
  listGuidelines: jest.fn(),
  listIngredients: jest.fn(),
  fetchAssignableUsers: jest.fn(),
  previewTaskCompletion: jest.fn(),
  confirmTaskCompletion: jest.fn(),
  listComments: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

const task: api.Task = {
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
}

function renderScreen() {
  const client = createQueryClient()
  // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <TaskDetailScreen />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocked.getTask.mockResolvedValue(task)
  mocked.listRecipes.mockResolvedValue([])
  mocked.listGuidelines.mockResolvedValue([])
  mocked.listIngredients.mockResolvedValue([])
  mocked.fetchAssignableUsers.mockResolvedValue([])
  mocked.listComments.mockResolvedValue([])
  mocked.previewTaskCompletion.mockResolvedValue({
    requiresConfirmation: true,
    hasNegativeWarning: false,
    deductions: [
      { ingredientId: 'ing-12345678', deductQty: 2, currentStock: 5, resultingStock: 3, wouldGoNegative: false },
    ],
  })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
})

describe('TaskDetailScreen completion overlay (M007 review P2)', () => {
  it('renders the overlay as a sibling of the ScrollView while a completion is pending', async () => {
    let finish!: (value: api.CompletionResult) => void
    mocked.confirmTaskCompletion.mockReturnValue(
      new Promise<api.CompletionResult>((resolve) => {
        finish = resolve
      }),
    )
    renderScreen()

    fireEvent.press(await screen.findByText('Move to Done'))
    expect(await screen.findByText('Confirm stock deduction')).toBeTruthy()
    expect(screen.getByText('-2 (→ 3)')).toBeTruthy()

    // The overlay sits after the ScrollView, not inside it, so it covers the scrolled content.
    const scroll = screen.UNSAFE_getByType(ScrollView)
    const root = scroll.parent
    expect(root).toBeTruthy()
    const children = root?.children ?? []
    const scrollIndex = children.findIndex((child) => typeof child !== 'string' && child === scroll)
    expect(scrollIndex).toBeGreaterThanOrEqual(0)
    expect(children.length).toBeGreaterThan(scrollIndex + 1)
    const overlay = children[scrollIndex + 1]
    expect(typeof overlay === 'string' ? null : overlay.findByProps({ children: 'Confirm stock deduction' })).toBeTruthy()

    // Still rendered while the confirm request is in flight.
    fireEvent.press(screen.getByText('Confirm'))
    expect(await screen.findByText('Confirming...')).toBeTruthy()
    expect(screen.getByText('Confirm stock deduction')).toBeTruthy()

    await act(async () => {
      finish({ task: { ...task, status: 'DONE' }, movements: [], hasNegativeWarning: false })
    })
    await waitFor(() => expect(screen.queryByText('Confirm stock deduction')).toBeNull())
  })
})
