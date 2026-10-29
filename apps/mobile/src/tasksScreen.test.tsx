import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import TasksScreen from '../app/tasks'
import * as api from './api'
import { createQueryClient } from './queryClient'
import { queryKeys } from './queryKeys'
import { expectFlashListKeyedBy, expectSafeAreaAndKeyboardAvoidance } from './testing/nativeFrame'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
const mockToken: { current: string | null } = { current: 'token-A' }

jest.mock('./session', () => ({
  session: {
    getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }),
    getToken: () => mockToken.current,
  },
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
  const view = render(
    <QueryClientProvider client={client}>
      <TasksScreen />
    </QueryClientProvider>,
  )
  return { ...view, client }
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
  mockToken.current = 'token-A'
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
    // Hold the refetch that follows the failure open so the cache can be inspected after onError and
    // before the refetch lands: otherwise the refetch (same data) would mask a missing rollback.
    let finishRefetch: (tasks: api.Task[]) => void = () => {}
    mocked.listTasks
      .mockResolvedValueOnce([task({})])
      .mockReturnValueOnce(new Promise((resolve) => (finishRefetch = resolve)))
    mocked.updateTaskStatus.mockRejectedValue(new Error('Conflict'))
    const { client } = renderScreen()

    fireEvent.press(await screen.findByText('Move to In Progress'))
    await waitFor(() => expect(mocked.listTasks).toHaveBeenCalledTimes(2))

    expect(client.getQueryData<api.Task[]>(queryKeys.tasks.list())?.[0].status).toBe('TODO')
    expect(screen.queryByText('Move to Done')).toBeNull()

    await act(async () => {
      finishRefetch([task({})])
    })
    expect(await screen.findByText('Conflict')).toBeTruthy()
    expect(screen.getByText('Move to In Progress')).toBeTruthy()
  })

  it('does not write user A data back into the cache when the session ended before the failure (M004 P2-1)', async () => {
    let rejectUpdate: (error: Error) => void = () => {}
    mocked.listTasks
      .mockResolvedValueOnce([task({})])
      .mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
    mocked.updateTaskStatus.mockReturnValue(new Promise((_resolve, reject) => (rejectUpdate = reject)))
    const { client } = renderScreen()

    fireEvent.press(await screen.findByText('Move to In Progress'))
    await waitFor(() => expect(mocked.updateTaskStatus).toHaveBeenCalled())
    expect(client.getQueryData<api.Task[]>(queryKeys.tasks.list())?.[0].status).toBe('IN_PROGRESS')

    // Logout (or a 401): the token goes away and the cache is cleared while the request is in flight.
    mockToken.current = null
    client.clear()
    await act(async () => {
      rejectUpdate(new Error('Conflict'))
    })

    expect(await screen.findByText('Conflict')).toBeTruthy()
    expect(client.getQueryData(queryKeys.tasks.list())).toBeUndefined()
  })

  it('does not restore into a cache that another user has since logged into (token changed, query repopulated)', async () => {
    let rejectUpdate: (error: Error) => void = () => {}
    mocked.listTasks.mockResolvedValueOnce([task({})])
    mocked.updateTaskStatus.mockReturnValue(new Promise((_resolve, reject) => (rejectUpdate = reject)))
    const { client } = renderScreen()

    fireEvent.press(await screen.findByText('Move to In Progress'))
    await waitFor(() => expect(mocked.updateTaskStatus).toHaveBeenCalled())

    mockToken.current = 'token-B'
    client.clear()
    client.setQueryData(queryKeys.tasks.list(), [task({ id: 'task-B', title: 'B only' })])
    await act(async () => {
      rejectUpdate(new Error('Conflict'))
    })

    await screen.findByText('Conflict')
    expect(client.getQueryData<api.Task[]>(queryKeys.tasks.list())?.map((t) => t.id)).toEqual(['task-B'])
  })

  it('keeps showing tasks without an error banner when a background refetch fails (M004 P3-a)', async () => {
    mocked.listTasks.mockResolvedValueOnce([task({})])
    const { client } = renderScreen()
    await screen.findByText('Prep onions')

    mocked.listTasks.mockRejectedValue(Object.assign(new Error('Server down'), { status: 403 }))
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.tasks.list() })
    })

    await waitFor(() => expect(client.getQueryState(queryKeys.tasks.list())?.status).toBe('error'))
    // react-query hands observer updates to React on a 0ms timer; let that render happen before asserting.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(screen.getByText('Prep onions')).toBeTruthy()
    expect(screen.queryByText('Server down')).toBeNull()
  })

  it('completing a task invalidates the dashboard alerts along with ingredients (M015 follow-up)', async () => {
    mocked.listTasks.mockResolvedValue([task({ status: 'IN_PROGRESS' })])
    mocked.previewTaskCompletion.mockResolvedValue({ requiresConfirmation: false, deductions: [], hasNegativeWarning: false })
    mocked.confirmTaskCompletion.mockResolvedValue({} as never)
    const { client } = renderScreen()
    client.setQueryData(queryKeys.alerts.lowStock(), [])
    client.setQueryData(queryKeys.ingredients.withStock(), [])

    fireEvent.press(await screen.findByText('Move to Done'))

    await waitFor(() => expect(mocked.confirmTaskCompletion).toHaveBeenCalledWith('task-1'))
    await waitFor(() => expect(client.getQueryState(queryKeys.alerts.lowStock())?.isInvalidated).toBe(true))
    expect(client.getQueryState(queryKeys.ingredients.withStock())?.isInvalidated).toBe(true)
  })
})

describe('TasksScreen native quality (M010)', () => {
  it('AC1: renders every bucket through one FlashList keyed by task id', async () => {
    mocked.listTasks.mockResolvedValue([
      task({ id: 't-todo', title: 'Prep onions' }),
      task({ id: 't-prog', title: 'Dice carrots', status: 'IN_PROGRESS' }),
      task({ id: 't-done', title: 'Wash pans', status: 'DONE' }),
    ])
    renderScreen()

    expect(await screen.findByText('Wash pans')).toBeTruthy()
    expect(screen.getByText('Prep onions')).toBeTruthy()
    expect(screen.getByText('Dice carrots')).toBeTruthy()
    // Section title and the row badge both carry the status label.
    for (const label of ['To Do', 'In Progress', 'Done']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expectFlashListKeyedBy(['t-todo', 't-prog', 't-done'])
  })

  it('AC1: keeps the empty-bucket text inside the list', async () => {
    mocked.listTasks.mockResolvedValue([task({ id: 't-todo' })])
    renderScreen()

    await screen.findByText('Prep onions')
    expect(screen.getAllByText('No tasks in this bucket.')).toHaveLength(2)
  })

  it('AC2 + AC3: sits in the safe area and avoids the keyboard', async () => {
    mocked.listTasks.mockResolvedValue([])
    renderScreen()

    await screen.findByText('No tasks returned.')
    expectSafeAreaAndKeyboardAvoidance()
  })

  it('AC3: the create form lives in the list header and keeps its inputs mounted across screen re-renders', async () => {
    mocked.listTasks.mockResolvedValue([task({ id: 't-todo' })])
    mocked.fetchAssignableUsers.mockResolvedValue([{ id: 'u2', email: 'cook@example.com' }])
    renderScreen()

    fireEvent.press(await screen.findByText('New task'))
    const input = screen.getByPlaceholderText('Task title')
    fireEvent.changeText(input, 'Sli')
    // Selecting an assignee chip updates screen state, so the screen (and its header element) re-renders.
    fireEvent.press(await screen.findByText('cook@example.com'))
    fireEvent.changeText(screen.getByPlaceholderText('Task title'), 'Slice')

    expect(screen.getByPlaceholderText('Task title')).toBe(input)
    expect(screen.getByDisplayValue('Slice')).toBeTruthy()
  })
})
