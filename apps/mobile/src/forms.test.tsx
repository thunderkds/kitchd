import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import AnnouncementsScreen from '../app/announcements'
import GuidelinesScreen from '../app/guidelines'
import HomeScreen from '../app/index'
import InventoryScreen from '../app/inventory'
import AcceptInviteScreen from '../app/invite/accept'
import InvitesScreen from '../app/invites'
import NotesScreen from '../app/notes'
import RecipesScreen from '../app/recipes'
import TasksScreen from '../app/tasks'
import * as api from './api'
import { createQueryClient } from './queryClient'

// M005 AC4: an invalid submit shows a field-level error and makes ZERO API calls. Each describe block
// proves that for one form by asserting the api.ts function (or fetch, for login) was never called.

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
const mockUser: { current: { id: string; email: string; role: string } | null } = {
  current: { id: 'u1', email: 'owner@example.com', role: 'OWNER' },
}

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}))
jest.mock('./storage', () => ({ persistSession: jest.fn() }))
jest.mock('./session', () => ({
  session: { getUser: () => mockUser.current, getToken: () => 'token-A' },
  toStoredUser: (user: unknown) => user,
}))
jest.mock('./api', () => ({
  listTasks: jest.fn(),
  listRecipes: jest.fn(),
  listGuidelines: jest.fn(),
  listIngredients: jest.fn(),
  listMovements: jest.fn(),
  listAnnouncements: jest.fn(),
  listNotes: jest.fn(),
  listPendingInvites: jest.fn(),
  fetchAssignableUsers: jest.fn(),
  createTask: jest.fn(),
  generateTaskFromRecipe: jest.fn(),
  generateTaskFromGuideline: jest.fn(),
  createRecipe: jest.fn(),
  updateRecipe: jest.fn(),
  getRecipe: jest.fn(),
  createGuideline: jest.fn(),
  updateGuideline: jest.fn(),
  getGuideline: jest.fn(),
  createNote: jest.fn(),
  createAnnouncement: jest.fn(),
  createIngredient: jest.fn(),
  updateIngredient: jest.fn(),
  receiveStock: jest.fn(),
  inviteMember: jest.fn(),
  acceptInvite: jest.fn(),
  currentStockFromMovements: (movements: { qty: number }[]) => movements.reduce((sum, m) => sum + m.qty, 0),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function renderWithClient(ui: ReactElement) {
  const client = createQueryClient()
  // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
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

const originalFetch = globalThis.fetch
const OWNER = { id: 'u1', email: 'owner@example.com', role: 'OWNER' }

// mutationFn: fn passes (variables, mutationContext) to fn, so assert on the variables (first argument) only.
const firstArg = (fn: unknown) => (fn as jest.Mock).mock.calls[0][0]

beforeEach(() => {
  mocked.listTasks.mockResolvedValue([])
  mocked.listRecipes.mockResolvedValue([])
  mocked.listGuidelines.mockResolvedValue([])
  mocked.listIngredients.mockResolvedValue([ingredient])
  mocked.listMovements.mockResolvedValue([])
  mocked.listAnnouncements.mockResolvedValue([])
  mocked.listNotes.mockResolvedValue([])
  mocked.listPendingInvites.mockResolvedValue([])
  mocked.fetchAssignableUsers.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
  globalThis.fetch = originalFetch
  mockUser.current = OWNER
  mockRouter.replace.mockReset()
})

// The "write" api functions of a screen: none of them may run for an invalid submit.
const writes = (...names: (keyof typeof api)[]) => names.map((name) => api[name] as unknown as jest.Mock)
const expectNoCalls = (...fns: jest.Mock[]) => fns.forEach((fn) => expect(fn).not.toHaveBeenCalled())

describe('login / signup form (index)', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    mockUser.current = null
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  it('signup: an empty submit shows every field error and never calls fetch', async () => {
    render(<HomeScreen />)

    fireEvent.press(screen.getByText('Create account'))

    expect(await screen.findByText('Email is required')).toBeTruthy()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy()
    expect(screen.getByText('Organization name is required')).toBeTruthy()
    expect(screen.getByText('Kitchen name is required')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('signup: a 7-character password is rejected with zero requests', async () => {
    render(<HomeScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'a@b.co')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), '1234567')
    fireEvent.changeText(screen.getByPlaceholderText('Organization name'), 'Org')
    fireEvent.changeText(screen.getByPlaceholderText('Kitchen name'), 'Main')

    fireEvent.press(screen.getByText('Create account'))

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('login: a malformed email and a blank password show field errors with zero requests', async () => {
    render(<HomeScreen />)
    fireEvent.press(screen.getAllByText('Log in')[0])
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'not-an-email')

    fireEvent.press(screen.getAllByText('Log in')[1])

    expect(await screen.findByText('Enter a valid email address')).toBeTruthy()
    expect(screen.getByText('Password is required')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('login: a valid submit posts only email + password', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 't', user: { id: 'u1', email: 'a@b.co', role: 'OWNER' } }),
    })
    render(<HomeScreen />)
    fireEvent.press(screen.getAllByText('Log in')[0])
    fireEvent.changeText(screen.getByPlaceholderText('Email'), ' a@b.co ')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'x')

    fireEvent.press(screen.getAllByText('Log in')[1])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/login$/)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@b.co', password: 'x' })
  })
})

describe('accept invite form', () => {
  it('blank token and a short password show field errors and never call acceptInvite', async () => {
    render(<AcceptInviteScreen />)

    fireEvent.changeText(screen.getByPlaceholderText('Password'), '1234567')
    fireEvent.press(screen.getAllByText('Accept invite')[1])

    expect(await screen.findByText('Invite token is required')).toBeTruthy()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy()
    expectNoCalls(...writes('acceptInvite'))
  })

  it('a token and an 8-character password call acceptInvite once', async () => {
    mocked.acceptInvite.mockResolvedValue({ accessToken: 't', user: { id: 'u', email: 'a@b.co', role: 'CHEF' } } as never)
    render(<AcceptInviteScreen />)

    fireEvent.changeText(screen.getByPlaceholderText('Invite token'), ' tok ')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), '12345678')
    fireEvent.press(screen.getAllByText('Accept invite')[1])

    await waitFor(() => expect(mocked.acceptInvite).toHaveBeenCalledWith('tok', '12345678'))
  })
})

describe('invite form', () => {
  it('blank and malformed emails show a field error and never call inviteMember', async () => {
    renderWithClient(<InvitesScreen />)
    await screen.findByText('No pending invites.')

    fireEvent.press(screen.getByText('Create invite'))
    expect(await screen.findByText('Email is required')).toBeTruthy()

    fireEvent.changeText(screen.getByPlaceholderText('Invite email'), 'nope')
    fireEvent.press(screen.getByText('Create invite'))
    expect(await screen.findByText('Enter a valid email address')).toBeTruthy()

    expectNoCalls(...writes('inviteMember'))
  })

  it('a valid email and role call inviteMember with the trimmed email', async () => {
    mocked.inviteMember.mockResolvedValue({ id: 'i1', email: 'new@example.com', role: 'CHEF', status: 'PENDING' } as never)
    renderWithClient(<InvitesScreen />)
    await screen.findByText('No pending invites.')

    fireEvent.changeText(screen.getByPlaceholderText('Invite email'), ' new@example.com ')
    fireEvent.press(screen.getByText('CHEF'))
    fireEvent.press(screen.getByText('Create invite'))

    await waitFor(() => expect(mocked.inviteMember).toHaveBeenCalledWith('new@example.com', 'CHEF'))
  })
})

describe('announcement form', () => {
  it('blank title and message show per-field errors and never call createAnnouncement', async () => {
    renderWithClient(<AnnouncementsScreen />)
    fireEvent.press(await screen.findByText('New announcement'))

    fireEvent.press(screen.getByText('Broadcast'))

    expect(await screen.findByText('Title is required')).toBeTruthy()
    expect(screen.getByText('Message is required')).toBeTruthy()
    expectNoCalls(...writes('createAnnouncement'))
  })

  it('a title and message call createAnnouncement with trimmed text', async () => {
    mocked.createAnnouncement.mockResolvedValue({} as never)
    renderWithClient(<AnnouncementsScreen />)
    fireEvent.press(await screen.findByText('New announcement'))

    fireEvent.changeText(screen.getByPlaceholderText('Title'), ' Hello ')
    fireEvent.changeText(screen.getByPlaceholderText('Message'), ' World ')
    fireEvent.press(screen.getByText('Broadcast'))

    await waitFor(() => expect(mocked.createAnnouncement).toHaveBeenCalledTimes(1))
    expect(firstArg(mocked.createAnnouncement)).toEqual({ title: 'Hello', body: 'World' })
  })
})

describe('note form', () => {
  it('a blank body shows a field error and never calls createNote', async () => {
    renderWithClient(<NotesScreen />)
    fireEvent.press(await screen.findByText('New note'))

    fireEvent.changeText(screen.getByPlaceholderText('Title (optional)'), 'Only a title')
    fireEvent.press(screen.getByText('Add note'))

    expect(await screen.findByText('Note body is required')).toBeTruthy()
    expectNoCalls(...writes('createNote'))
  })

  it('splits tags and omits a blank title', async () => {
    mocked.createNote.mockResolvedValue({} as never)
    renderWithClient(<NotesScreen />)
    fireEvent.press(await screen.findByText('New note'))

    fireEvent.changeText(screen.getByPlaceholderText('Write a note...'), ' body ')
    fireEvent.changeText(screen.getByPlaceholderText('Tags, comma separated'), 'a, b,,c')
    fireEvent.press(screen.getByText('Add note'))

    await waitFor(() => expect(mocked.createNote).toHaveBeenCalledTimes(1))
    expect(firstArg(mocked.createNote)).toEqual({ title: undefined, body: 'body', tags: ['a', 'b', 'c'] })
  })
})

describe('guideline form', () => {
  it('a blank title shows a field error and never calls createGuideline', async () => {
    renderWithClient(<GuidelinesScreen />)
    fireEvent.press(await screen.findByText('New guideline'))

    fireEvent.press(screen.getByText('Create'))

    expect(await screen.findByText('Guideline title is required')).toBeTruthy()
    expectNoCalls(...writes('createGuideline', 'updateGuideline'))
  })

  it('creates with the chosen type and split steps', async () => {
    mocked.createGuideline.mockResolvedValue({} as never)
    renderWithClient(<GuidelinesScreen />)
    fireEvent.press(await screen.findByText('New guideline'))

    fireEvent.changeText(screen.getByPlaceholderText('Title'), ' Close ')
    fireEvent.press(screen.getByText('CHECKLIST'))
    fireEvent.changeText(screen.getByPlaceholderText('Steps, one per line'), 'lock\n\nlights')
    fireEvent.press(screen.getByText('Create'))

    await waitFor(() =>
      expect(mocked.createGuideline).toHaveBeenCalledWith({ title: 'Close', type: 'CHECKLIST', steps: ['lock', 'lights'] }),
    )
  })
})

describe('task create form', () => {
  const openCreate = async () => {
    renderWithClient(<TasksScreen />)
    fireEvent.press(await screen.findByText('New task'))
  }
  const taskWrites = () => writes('createTask', 'generateTaskFromRecipe', 'generateTaskFromGuideline')

  it('a blank title shows a field error and never calls createTask', async () => {
    await openCreate()

    fireEvent.press(screen.getAllByText('Create task')[1])

    expect(await screen.findByText('Title is required')).toBeTruthy()
    expectNoCalls(...taskWrites())
  })

  it('an impossible due date is rejected instead of being silently dropped', async () => {
    await openCreate()
    fireEvent.changeText(screen.getByPlaceholderText('Task title'), 'Prep')
    fireEvent.changeText(screen.getByPlaceholderText('Due date YYYY-MM-DD'), '2026-02-31')

    fireEvent.press(screen.getAllByText('Create task')[1])

    expect(await screen.findByText('Due date must be a valid YYYY-MM-DD date')).toBeTruthy()
    expectNoCalls(...taskWrites())
  })

  it('from-recipe and from-guideline modes require a selection', async () => {
    await openCreate()

    fireEvent.press(screen.getByText('From recipe'))
    fireEvent.press(screen.getAllByText('Create task')[1])
    expect(await screen.findByText('Select a recipe')).toBeTruthy()

    fireEvent.press(screen.getByText('From guideline'))
    fireEvent.press(screen.getAllByText('Create task')[1])
    expect(await screen.findByText('Select a guideline')).toBeTruthy()

    expectNoCalls(...taskWrites())
  })

  it('a titled task calls createTask with just the title', async () => {
    mocked.createTask.mockResolvedValue({} as never)
    await openCreate()

    fireEvent.changeText(screen.getByPlaceholderText('Task title'), ' Prep ')
    fireEvent.press(screen.getAllByText('Create task')[1])

    await waitFor(() => expect(mocked.createTask).toHaveBeenCalledWith({ title: 'Prep' }))
  })
})

describe('recipe form', () => {
  const openCreate = async () => {
    renderWithClient(<RecipesScreen />)
    fireEvent.press(await screen.findByText('New recipe'))
  }

  it('a blank name and no ingredient show field errors and never call createRecipe', async () => {
    await openCreate()

    fireEvent.press(screen.getByText('Save recipe'))

    expect(await screen.findByText('Recipe name is required')).toBeTruthy()
    expect(screen.getByText('Add at least one ingredient')).toBeTruthy()
    expectNoCalls(...writes('createRecipe', 'updateRecipe'))
  })

  it('a non-positive quantity and a fractional servings are rejected on their own fields', async () => {
    await openCreate()
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Soup')
    fireEvent.changeText(screen.getByPlaceholderText('Servings'), '2.5')
    fireEvent.press(await screen.findByText('Choose ingredient'))
    fireEvent.press(screen.getByText('Onion (kg)'))
    fireEvent.changeText(screen.getByPlaceholderText('Quantity'), '0')

    fireEvent.press(screen.getByText('Save recipe'))

    expect(await screen.findByText('Quantity must be greater than 0')).toBeTruthy()
    expect(screen.getByText('Servings must be a whole number greater than 0')).toBeTruthy()
    expectNoCalls(...writes('createRecipe', 'updateRecipe'))
  })

  it('after a failed submit, fixing the fields clears the errors and the next submit goes through', async () => {
    mocked.createRecipe.mockResolvedValue({} as never)
    await openCreate()
    fireEvent.press(screen.getByText('Save recipe'))
    expect(await screen.findByText('Add at least one ingredient')).toBeTruthy()
    expectNoCalls(...writes('createRecipe'))

    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Soup')
    fireEvent.press(screen.getByText('Choose ingredient'))
    fireEvent.press(screen.getByText('Onion (kg)'))
    fireEvent.changeText(screen.getByPlaceholderText('Quantity'), '2')

    // Compare booleans: a failing toBeNull() pretty-prints the whole element tree on every poll, which is slow.
    await waitFor(() => expect(screen.queryByText('Add at least one ingredient') === null).toBe(true))
    expect(screen.queryByText('Recipe name is required') === null).toBe(true)

    fireEvent.press(screen.getByText('Save recipe'))
    await waitFor(() => expect(mocked.createRecipe).toHaveBeenCalledTimes(1))
  })

  it('a valid recipe calls createRecipe with parsed numbers', async () => {
    mocked.createRecipe.mockResolvedValue({} as never)
    await openCreate()
    fireEvent.changeText(screen.getByPlaceholderText('Name'), ' Soup ')
    fireEvent.changeText(screen.getByPlaceholderText('Servings'), '4')
    fireEvent.changeText(screen.getByPlaceholderText('Steps, one per line'), 'chop\nboil')
    fireEvent.press(await screen.findByText('Choose ingredient'))
    fireEvent.press(screen.getByText('Onion (kg)'))
    fireEvent.changeText(screen.getByPlaceholderText('Quantity'), '1.5')

    fireEvent.press(screen.getByText('Save recipe'))

    await waitFor(() =>
      expect(mocked.createRecipe).toHaveBeenCalledWith({
        name: 'Soup',
        steps: ['chop', 'boil'],
        servings: 4,
        ingredients: [{ ingredientId: 'ing-1', qty: 1.5 }],
      }),
    )
  })
})

describe('ingredient form (T041/T049 threshold rules)', () => {
  const ingredientWrites = () => writes('createIngredient', 'updateIngredient')
  const fillCreate = (over: Partial<Record<'Name' | 'Unit' | 'Cost per unit' | 'Low-stock threshold', string>> = {}) => {
    const values = { Name: 'Garlic', Unit: 'kg', 'Cost per unit': '4', 'Low-stock threshold': '', ...over }
    for (const [placeholder, value] of Object.entries(values)) {
      fireEvent.changeText(screen.getByPlaceholderText(placeholder), value)
    }
  }
  const openCreate = async () => {
    renderWithClient(<InventoryScreen />)
    fireEvent.press(await screen.findByText('Add ingredient'))
  }

  it('empty required fields show field errors and never call the api', async () => {
    await openCreate()

    fireEvent.press(screen.getByText('Save ingredient'))

    expect(await screen.findByText('Name is required')).toBeTruthy()
    expect(screen.getByText('Unit is required')).toBeTruthy()
    expect(screen.getByText('Cost per unit must be a number greater than 0')).toBeTruthy()
    expectNoCalls(...ingredientWrites())
  })

  it.each(['0', '-1', 'abc'])('rejects a low-stock threshold of %p with zero requests', async (threshold) => {
    await openCreate()
    fillCreate({ 'Low-stock threshold': threshold })

    fireEvent.press(screen.getByText('Save ingredient'))

    expect(
      await screen.findByText('Low stock threshold must be a number greater than 0 — leave it blank for no threshold'),
    ).toBeTruthy()
    expectNoCalls(...ingredientWrites())
  })

  it('rejects a zero or blank cost instead of sending it', async () => {
    await openCreate()
    fillCreate({ 'Cost per unit': '0' })
    fireEvent.press(screen.getByText('Save ingredient'))
    expect(await screen.findByText('Cost per unit must be a number greater than 0')).toBeTruthy()
    expectNoCalls(...ingredientWrites())
  })

  it('create with a blank threshold sends NO minThreshold key', async () => {
    mocked.createIngredient.mockResolvedValue(ingredient)
    await openCreate()
    fillCreate()

    fireEvent.press(screen.getByText('Save ingredient'))

    await waitFor(() => expect(mocked.createIngredient).toHaveBeenCalledTimes(1))
    const payload = mocked.createIngredient.mock.calls[0][0]
    expect(payload).toEqual({ name: 'Garlic', unit: 'kg', costPerUnit: 4 })
    expect('minThreshold' in payload).toBe(false)
  })

  it('edit with a cleared threshold sends an explicit null', async () => {
    mocked.updateIngredient.mockResolvedValue(ingredient)
    renderWithClient(<InventoryScreen />)
    fireEvent.press(await screen.findByText('Edit'))

    expect(screen.getByPlaceholderText('Low-stock threshold').props.value).toBe('5')
    fireEvent.changeText(screen.getByPlaceholderText('Low-stock threshold'), '')
    fireEvent.press(screen.getByText('Save ingredient'))

    await waitFor(() => expect(mocked.updateIngredient).toHaveBeenCalledTimes(1))
    expect(mocked.updateIngredient.mock.calls[0]).toEqual([
      'ing-1',
      { name: 'Onion', unit: 'kg', costPerUnit: 2, minThreshold: null },
    ])
  })

  it('receive stock: a zero quantity shows a field error and never calls receiveStock', async () => {
    renderWithClient(<InventoryScreen />)
    fireEvent.press(await screen.findByText('Receive stock'))
    fireEvent.changeText(screen.getByPlaceholderText('Receive qty'), '0')

    fireEvent.press(screen.getByText('Confirm'))

    expect(await screen.findByText('Enter a quantity greater than zero')).toBeTruthy()
    expectNoCalls(...writes('receiveStock'))
  })
})

describe('task create form: all errors at once', () => {
  it('a blank title and a bad due date are both shown after one submit, with zero requests', async () => {
    renderWithClient(<TasksScreen />)
    fireEvent.press(await screen.findByText('New task'))
    fireEvent.changeText(screen.getByPlaceholderText('Due date YYYY-MM-DD'), 'tomorrow')

    fireEvent.press(screen.getAllByText('Create task')[1])

    expect(await screen.findByText('Title is required')).toBeTruthy()
    expect(screen.getByText('Due date must be a valid YYYY-MM-DD date')).toBeTruthy()
    expectNoCalls(...writes('createTask', 'generateTaskFromRecipe', 'generateTaskFromGuideline'))
  })
})

describe('login with a unicode / IDN email', () => {
  it('is sent to the API instead of being blocked client-side', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 't', user: { id: 'u1', email: 'josé@example.com', role: 'OWNER' } }),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    mockUser.current = null
    render(<HomeScreen />)
    fireEvent.press(screen.getAllByText('Log in')[0])
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'josé@example.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'x')

    fireEvent.press(screen.getAllByText('Log in')[1])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'josé@example.com', password: 'x' })
  })
})
