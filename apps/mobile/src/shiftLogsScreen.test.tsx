import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import ShiftLogsScreen from '../app/shift-logs'
import * as api from './api'
import { createQueryClient } from './queryClient'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
let mockRole = 'CHEF'

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: { getUser: () => ({ id: 'u1', email: 'chef@example.com', role: mockRole }) },
}))
jest.mock('./api', () => ({
  listShiftLogs: jest.fn(),
  createShiftLog: jest.fn(),
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
      <ShiftLogsScreen />
    </QueryClientProvider>,
  )
}

const log = (over: Partial<api.ShiftLog>): api.ShiftLog => ({
  id: 'log-1',
  kitchenId: 'k1',
  authorId: 'u1',
  shift: 'MORNING',
  body: 'Walk-in cooler was at 4C',
  createdAt: '2026-10-29T08:00:00.000Z',
  ...over,
})

beforeEach(() => {
  mockRole = 'CHEF'
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
  mockRouter.replace.mockReset()
})

describe('ShiftLogsScreen (M014)', () => {
  it('AC1: shows loading, then the logs in the order the API returned them (newest first)', async () => {
    mocked.listShiftLogs.mockResolvedValue([
      log({ id: 'b', body: 'Newer evening note', shift: 'EVENING' }),
      log({ id: 'a', body: 'Older morning note' }),
    ])
    renderScreen()

    expect(screen.getByText('Loading shift logs...')).toBeTruthy()
    expect(await screen.findByText('Newer evening note')).toBeTruthy()
    expect(screen.queryByText('Loading shift logs...')).toBeNull()
    const bodies = screen.getAllByTestId('shift-log-body').map((node) => node.props.children)
    expect(bodies).toEqual(['Newer evening note', 'Older morning note'])
    const shifts = screen.getAllByTestId('shift-log-shift').map((node) => node.props.children)
    expect(shifts).toEqual(['Evening', 'Morning'])
  })

  it('AC1: shows the empty text when there are no logs', async () => {
    mocked.listShiftLogs.mockResolvedValue([])
    renderScreen()

    expect(await screen.findByText('No shift logs yet.')).toBeTruthy()
  })

  it('AC1: shows the API error when loading fails', async () => {
    mocked.listShiftLogs.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
    renderScreen()

    expect(await screen.findByText('Forbidden')).toBeTruthy()
    expect(screen.queryByText('Loading shift logs...')).toBeNull()
    expect(screen.queryByText('No shift logs yet.')).toBeNull()
  })

  it('AC2: a VIEWER sees the logs but no composer', async () => {
    mockRole = 'VIEWER'
    mocked.listShiftLogs.mockResolvedValue([log({})])
    renderScreen()

    expect(await screen.findByText('Walk-in cooler was at 4C')).toBeTruthy()
    expect(screen.queryByText('Add shift log')).toBeNull()
    expect(screen.queryByLabelText('Shift log body')).toBeNull()
  })

  it.each(['OWNER', 'ADMIN', 'CHEF', 'STAFF'])('AC2: %s sees the composer', async (role) => {
    mockRole = role
    mocked.listShiftLogs.mockResolvedValue([])
    renderScreen()

    expect(await screen.findByLabelText('Shift log body')).toBeTruthy()
    expect(screen.getByText('Add shift log')).toBeTruthy()
  })

  it('AC2: an unknown role gets no composer (allow-list, not deny-list)', async () => {
    mockRole = 'GUEST'
    mocked.listShiftLogs.mockResolvedValue([])
    renderScreen()

    expect(await screen.findByText('No shift logs yet.')).toBeTruthy()
    expect(screen.queryByLabelText('Shift log body')).toBeNull()
  })

  it('AC2: an empty body is blocked in the form and nothing is posted', async () => {
    mocked.listShiftLogs.mockResolvedValue([])
    renderScreen()

    fireEvent.changeText(await screen.findByLabelText('Shift log body'), '   ')
    fireEvent.press(screen.getByText('Add shift log'))

    expect(await screen.findByText('Shift log body is required.')).toBeTruthy()
    expect(mocked.createShiftLog).not.toHaveBeenCalled()
  })

  it('AC2: posts { shift, body }, clears the form and refetches the list', async () => {
    mocked.listShiftLogs
      .mockResolvedValueOnce([])
      .mockResolvedValue([log({ id: 'new', body: 'Deep clean done', shift: 'EVENING' })])
    mocked.createShiftLog.mockResolvedValue(log({ id: 'new', body: 'Deep clean done', shift: 'EVENING' }))
    renderScreen()

    fireEvent.changeText(await screen.findByLabelText('Shift log body'), '  Deep clean done  ')
    fireEvent.press(screen.getByLabelText('Evening shift'))
    fireEvent.press(screen.getByText('Add shift log'))

    await waitFor(() => expect(mocked.createShiftLog).toHaveBeenCalledWith({ shift: 'EVENING', body: 'Deep clean done' }))
    expect(await screen.findByTestId('shift-log-body')).toBeTruthy()
    expect(screen.getByTestId('shift-log-body').props.children).toBe('Deep clean done')
    expect(mocked.listShiftLogs).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('Shift log body').props.value).toBe('')
  })

  it('AC2: defaults to the MORNING shift', async () => {
    mocked.listShiftLogs.mockResolvedValue([])
    mocked.createShiftLog.mockResolvedValue(log({}))
    renderScreen()

    fireEvent.changeText(await screen.findByLabelText('Shift log body'), 'Opened up')
    fireEvent.press(screen.getByText('Add shift log'))

    await waitFor(() => expect(mocked.createShiftLog).toHaveBeenCalledWith({ shift: 'MORNING', body: 'Opened up' }))
  })

  it('AC2: shows a failed post inside the form, keeps the text, and leaves the list alone', async () => {
    mocked.listShiftLogs.mockResolvedValue([log({})])
    mocked.createShiftLog.mockRejectedValue(new Error('Body too long'))
    renderScreen()

    fireEvent.changeText(await screen.findByLabelText('Shift log body'), 'Something')
    fireEvent.press(screen.getByText('Add shift log'))

    const form = screen.getByTestId('shift-log-form')
    expect(await within(form).findByText('Body too long')).toBeTruthy()
    expect(screen.getByLabelText('Shift log body').props.value).toBe('Something')
    expect(screen.getByText('Walk-in cooler was at 4C')).toBeTruthy()
  })

  it('AC2: a load error is not shown inside the form', async () => {
    mocked.listShiftLogs.mockRejectedValue(Object.assign(new Error('Boom'), { status: 403 }))
    renderScreen()

    const message = await screen.findByText('Boom')
    expect(within(screen.getByTestId('shift-log-form')).queryByText('Boom')).toBeNull()
    expect(message).toBeTruthy()
  })
})
