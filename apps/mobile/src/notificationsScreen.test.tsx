import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { renderHook } from '@testing-library/react-native'
import DashboardScreen from '../app/dashboard'
import NotificationsScreen from '../app/notifications'
import * as api from './api'
import { useNotifications } from './queries'
import { queryKeys } from './queryKeys'
import { createQueryClient } from './queryClient'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: { getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }) },
}))
jest.mock('./storage', () => ({ clearSession: jest.fn() }))
jest.mock('./signOut', () => ({ signOut: jest.fn() }))
// The dashboard also mounts AlertWidgets (M015); they are irrelevant to the notification badge.
jest.mock('./components/AlertWidgets', () => ({ AlertWidgets: () => null }))
jest.mock('./api', () => ({
  fetchNotifications: jest.fn(),
  markNotificationsRead: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

function wrap(ui: React.ReactElement, client = createQueryClient()) {
  // A finished mutation keeps a 5-minute gc timer that client.clear() does not cancel, which holds jest open.
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) }
}

const notification = (over: Partial<api.NotificationItem>): api.NotificationItem => ({
  id: 'n1',
  type: 'MENTION',
  body: 'You were mentioned in a comment by sam',
  read: false,
  createdAt: '2026-10-29T10:00:00.000Z',
  ...over,
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
  mockRouter.push.mockReset()
  mockRouter.replace.mockReset()
})

describe('M008 AC1: dashboard unread badge', () => {
  it('shows the unread count from the feed', async () => {
    mocked.fetchNotifications.mockResolvedValue({ notifications: [notification({})], unreadCount: 3 })
    wrap(<DashboardScreen />)

    expect(await screen.findByTestId('notifications-unread-badge')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('hides the badge when the unread count is 0', async () => {
    mocked.fetchNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 })
    const { client } = wrap(<DashboardScreen />)

    await waitFor(() => expect(mocked.fetchNotifications).toHaveBeenCalled())
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.queryByTestId('notifications-unread-badge')).toBeNull()
  })

  it('opens the notifications screen from the dashboard row', async () => {
    mocked.fetchNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 })
    const { client } = wrap(<DashboardScreen />)

    fireEvent.press(await screen.findByText('Open notifications'))
    expect(mockRouter.push).toHaveBeenCalledWith('/notifications')
    await waitFor(() => expect(client.isFetching()).toBe(0))
  })
})

describe('M008 AC2: notifications list', () => {
  it('lists notifications with read and unread state', async () => {
    mocked.fetchNotifications.mockResolvedValue({
      notifications: [
        notification({ id: 'n1', body: 'Mentioned by sam', read: false }),
        notification({ id: 'n2', type: 'LOW_STOCK', body: 'Flour is low', read: true }),
      ],
      unreadCount: 1,
    })
    wrap(<NotificationsScreen />)

    expect(screen.getByText('Loading notifications...')).toBeTruthy()
    expect(await screen.findByText('Mentioned by sam')).toBeTruthy()
    expect(screen.getByText('Flour is low')).toBeTruthy()
    expect(screen.getByTestId('notification-n1-state').props.children).toBe('Unread')
    expect(screen.getByTestId('notification-n2-state').props.children).toBe('Read')
  })

  it('shows an empty state', async () => {
    mocked.fetchNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 })
    wrap(<NotificationsScreen />)

    expect(await screen.findByText('No notifications yet.')).toBeTruthy()
    expect(screen.queryByText('Mark all as read')).toBeNull()
  })

  it('shows the API error message when loading fails', async () => {
    mocked.fetchNotifications.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }))
    wrap(<NotificationsScreen />)

    expect(await screen.findByText('Forbidden')).toBeTruthy()
  })
})

describe('M008 AC3: mark-read', () => {
  it('posts mark-read (no body) then refetches so the unread state updates', async () => {
    mocked.fetchNotifications
      .mockResolvedValueOnce({ notifications: [notification({ id: 'n1', read: false })], unreadCount: 1 })
      .mockResolvedValue({ notifications: [notification({ id: 'n1', read: true })], unreadCount: 0 })
    mocked.markNotificationsRead.mockResolvedValue({ unreadCount: 0 })
    wrap(<NotificationsScreen />)

    fireEvent.press(await screen.findByText('Mark all as read'))

    await waitFor(() => expect(mocked.markNotificationsRead).toHaveBeenCalledTimes(1))
    expect(mocked.markNotificationsRead).toHaveBeenCalledWith()
    await waitFor(() => expect(screen.getByTestId('notification-n1-state').props.children).toBe('Read'))
    expect(mocked.fetchNotifications).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Mark all as read')).toBeNull()
  })

  it('invalidates the notifications prefix so the dashboard badge updates', async () => {
    const client = createQueryClient()
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    mocked.fetchNotifications.mockResolvedValue({ notifications: [notification({})], unreadCount: 1 })
    mocked.markNotificationsRead.mockResolvedValue({ unreadCount: 0 })
    wrap(<NotificationsScreen />, client)

    fireEvent.press(await screen.findByText('Mark all as read'))

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] }))
    expect(queryKeys.notifications.all).toEqual(['notifications'])
  })

  it('shows the error when mark-read fails', async () => {
    mocked.fetchNotifications.mockResolvedValue({ notifications: [notification({})], unreadCount: 1 })
    mocked.markNotificationsRead.mockRejectedValue(new Error('Server down'))
    wrap(<NotificationsScreen />)

    fireEvent.press(await screen.findByText('Mark all as read'))

    expect(await screen.findByText('Server down')).toBeTruthy()
  })

  it('clears the error once a later mark-read succeeds (review P2)', async () => {
    mocked.fetchNotifications
      .mockResolvedValueOnce({ notifications: [notification({})], unreadCount: 1 })
      .mockResolvedValue({ notifications: [notification({ read: true })], unreadCount: 0 })
    mocked.markNotificationsRead.mockRejectedValueOnce(new Error('Server down')).mockResolvedValue({ unreadCount: 0 })
    wrap(<NotificationsScreen />)

    fireEvent.press(await screen.findByText('Mark all as read'))
    expect(await screen.findByText('Server down')).toBeTruthy()

    fireEvent.press(screen.getByText('Mark all as read'))

    await waitFor(() => expect(mocked.markNotificationsRead).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('Server down')).toBeNull())
    await waitFor(() => expect(screen.getByTestId('notification-n1-state').props.children).toBe('Read'))
  })

  it('clears the error when a later refetch succeeds', async () => {
    mocked.fetchNotifications.mockResolvedValue({ notifications: [notification({})], unreadCount: 1 })
    mocked.markNotificationsRead.mockRejectedValue(new Error('Server down'))
    const { client } = wrap(<NotificationsScreen />)

    fireEvent.press(await screen.findByText('Mark all as read'))
    expect(await screen.findByText('Server down')).toBeTruthy()

    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.notifications.all })
    })

    await waitFor(() => expect(screen.queryByText('Server down')).toBeNull())
  })

  it('keeps the error while nothing has succeeded since the failure', async () => {
    mocked.fetchNotifications.mockResolvedValue({ notifications: [notification({})], unreadCount: 1 })
    mocked.markNotificationsRead.mockRejectedValue(new Error('Server down'))
    const { client } = wrap(<NotificationsScreen />)

    fireEvent.press(await screen.findByText('Mark all as read'))
    expect(await screen.findByText('Server down')).toBeTruthy()
    await waitFor(() => expect(client.isMutating()).toBe(0))

    expect(screen.getByText('Server down')).toBeTruthy()
  })
})

describe('useNotifications', () => {
  it('does not fetch while disabled', async () => {
    const client = createQueryClient()
    clients.push(client)
    const { unmount } = renderHook(() => useNotifications(false), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    expect(mocked.fetchNotifications).not.toHaveBeenCalled()
    unmount()
  })
})
