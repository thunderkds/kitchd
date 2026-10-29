import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import TasksScreen from '../app/tasks'
import * as api from './api'
import { createQueryClient } from './queryClient'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: { getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }) },
}))
jest.mock('./api', () => ({
  listTasks: jest.fn(),
  listRecipes: jest.fn(),
  listGuidelines: jest.fn(),
  listIngredients: jest.fn(),
  fetchAssignableUsers: jest.fn(),
  updateTaskStatus: jest.fn(),
  createTask: jest.fn(),
  generateTaskFromRecipe: jest.fn(),
  generateTaskFromGuideline: jest.fn(),
  previewTaskCompletion: jest.fn(),
  confirmTaskCompletion: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function renderScreen() {
  const client = createQueryClient()
  // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <TasksScreen />
    </QueryClientProvider>,
  )
}

const task = (over: Partial<api.Task>): api.Task =>
  ({
    id: 'task-1',
    title: 'Prep onions',
    status: 'TODO',
    assigneeId: null,
    dueAt: null,
    checklistItems: [],
    sourceRecipeId: null,
    sourceGuidelineId: null,
    ...over,
  }) as api.Task

beforeEach(() => {
  mocked.listRecipes.mockResolvedValue([])
  mocked.listGuidelines.mockResolvedValue([])
  mocked.listIngredients.mockResolvedValue([])
  mocked.fetchAssignableUsers.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
  mockRouter.replace.mockReset()
})

describe('TasksScreen on TanStack Query (M004 AC5: UI text unchanged)', () => {
  it('shows the loading text, then the tasks', async () => {
    mocked.listTasks.mockResolvedValue([task({})])
    renderScreen()

    expect(screen.getByText('Loading tasks...')).toBeTruthy()
    expect(await screen.findByText('Prep onions')).toBeTruthy()
    expect(screen.queryByText('Loading tasks...')).toBeNull()
    expect(screen.queryByText('No tasks returned.')).toBeNull()
  })

  it('shows the empty text when no tasks are returned', async () => {
    mocked.listTasks.mockResolvedValue([])
    renderScreen()

    expect(await screen.findByText('No tasks returned.')).toBeTruthy()
    expect(screen.getAllByText('No tasks in this bucket.')).toHaveLength(3)
  })

  it('shows the API error message when loading fails', async () => {
    mocked.listTasks.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
    renderScreen()

    expect(await screen.findByText('Forbidden')).toBeTruthy()
    expect(screen.queryByText('Loading tasks...')).toBeNull()
  })

  it('moves a task forward and refetches the list (write path = useMutation + invalidate)', async () => {
    mocked.listTasks
      .mockResolvedValueOnce([task({})])
      .mockResolvedValue([task({ status: 'IN_PROGRESS' })])
    mocked.updateTaskStatus.mockResolvedValue(task({ status: 'IN_PROGRESS' }))
    renderScreen()

    fireEvent.press(await screen.findByText('Move to In Progress'))

    await waitFor(() => expect(mocked.updateTaskStatus).toHaveBeenCalledWith('task-1', 'IN_PROGRESS'))
    await waitFor(() => expect(screen.getByText('Move to Done')).toBeTruthy())
    expect(mocked.listTasks).toHaveBeenCalledTimes(2)
  })

  it('rolls back and shows the error when the status update fails', async () => {
    mocked.listTasks.mockResolvedValue([task({})])
    mocked.updateTaskStatus.mockRejectedValue(new Error('Conflict'))
    renderScreen()

    fireEvent.press(await screen.findByText('Move to In Progress'))

    expect(await screen.findByText('Conflict')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Move to In Progress')).toBeTruthy())
  })
})
