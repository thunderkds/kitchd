import type { ReactElement } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react-native'
import type { StoredUser } from '@kitchenos/shared'
import TeamScreen from '../app/team'
import InvitesScreen from '../app/invites'
import HomeScreen from '../app/index'
import NotificationsScreen from '../app/notifications'
import ShiftLogsScreen from '../app/shift-logs'
import AcceptInviteScreen from '../app/invite/accept'
import RootLayout from '../app/_layout'
import * as api from './api'
import { createQueryClient } from './queryClient'
import { PALETTES, ThemeContext, createThemeStore, type ThemeStore } from './theme'

// M020: theme rollout, group B. Same shape as announcementsTheme.test.tsx (M006): the palette comes
// from useTheme(), which reads the stored user's themePreference.
const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
let mockUser: StoredUser | null = null

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  Stack: () => null,
}))
jest.mock('./session', () => ({
  session: {
    getUser: () => mockUser,
    setUser: (user: StoredUser) => {
      mockUser = user
    },
  },
  toStoredUser: jest.fn(),
}))
jest.mock('./storage', () => ({ persistSession: jest.fn(), sessionReady: new Promise<void>(() => {}) }))
jest.mock('./realtime', () => ({ startRealtime: () => () => undefined }))
jest.mock('./queryClient', () => {
  const actual = jest.requireActual('./queryClient')
  return { ...actual, queryClient: actual.createQueryClient() }
})
jest.mock('./api', () => ({
  listMembers: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
  listPendingInvites: jest.fn(),
  inviteMember: jest.fn(),
  revokeInvite: jest.fn(),
  fetchNotifications: jest.fn(),
  markNotificationsRead: jest.fn(),
  listShiftLogs: jest.fn(),
  createShiftLog: jest.fn(),
  acceptInvite: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const client = createQueryClient()
client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean))

// The first ancestor (or the node itself) whose style sets `prop`: Pressable styles live on the host View above its Text.
function styleOf(node: { props: { style?: unknown }; parent: unknown }, prop: string) {
  let current = node as { props: { style?: unknown }; parent: unknown } | null
  while (current) {
    const value = flat(current.props.style)[prop]
    if (value !== undefined) return value
    current = current.parent as typeof current
  }
  return undefined
}

const THEMES = [
  ['simple', '#86a0ff', '#6b8cff'],
  ['dark-neon', '#ff6b8b', '#d51944'],
] as const

const asUser = (role: StoredUser['role'], themePreference: StoredUser['themePreference']): StoredUser => ({
  id: 'me',
  email: 'owner@example.com',
  organizationId: 'o',
  kitchenId: 'k',
  role,
  themePreference,
})

const withQuery = (ui: ReactElement) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>

afterEach(() => {
  cleanup()
  client.clear()
  mockUser = null
})

describe.each(THEMES)('%s palette (M020 AC1, AC2, AC4)', (themePreference, kicker, accent) => {
  it('team screen: kicker and the active role chip', async () => {
    mockUser = asUser('OWNER', themePreference)
    mocked.listMembers.mockResolvedValue([
      { id: 'me', email: 'owner@example.com', role: 'OWNER', isActive: true },
      { id: 'chef', email: 'chef@example.com', role: 'CHEF', isActive: true },
    ])
    render(withQuery(<TeamScreen />))

    await screen.findByText('chef@example.com')
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
    expect(styleOf(screen.getByLabelText('Set role of chef@example.com to CHEF'), 'backgroundColor')).toBe(accent)
    expect(flat(screen.getByText('Team roster').props.style).color).toBe('#f4f7ff')
  })

  it('team screen (non-manager notice): kicker', () => {
    mockUser = asUser('STAFF', themePreference)
    render(withQuery(<TeamScreen />))

    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
  })

  it('invites screen: background, card, kicker and primary button', async () => {
    mockUser = asUser('OWNER', themePreference)
    mocked.listPendingInvites.mockResolvedValue([])
    render(withQuery(<InvitesScreen />))

    await screen.findByText('No pending invites.')
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
    expect(styleOf(screen.getByText('Create invite'), 'backgroundColor')).toBe(accent)
    expect(styleOf(screen.getByText('Invites'), 'backgroundColor')).toBe('#171c26')
  })

  it('login screen: kicker and primary button follow the stored theme', () => {
    const store: ThemeStore = createThemeStore()
    mockUser = asUser('OWNER', themePreference)
    // Signed in -> the redirect view; the form itself is covered below with an injected store.
    render(
      <ThemeContext.Provider value={store}>
        <HomeScreen />
      </ThemeContext.Provider>,
    )

    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
  })

  it('login form: primary button takes the accent when the theme is injected (no signed-in user)', () => {
    mockUser = null
    const store: ThemeStore = { ...createThemeStore(), getPreference: () => themePreference }
    render(
      <ThemeContext.Provider value={store}>
        <HomeScreen />
      </ThemeContext.Provider>,
    )

    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
    expect(styleOf(screen.getByText('Create account'), 'backgroundColor')).toBe(accent)
  })

  it('invite-accept screen: kicker and primary button', () => {
    mockUser = asUser('OWNER', themePreference)
    render(<AcceptInviteScreen />)

    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
    // Title and button share the text "Accept invite"; the button is the second.
    expect(styleOf(screen.getAllByText('Accept invite')[1], 'backgroundColor')).toBe(accent)
    expect(flat(screen.getByText(/Paste the invite token/).props.style).color).toBe('#ccd5e6')
  })

  it('notifications screen: kicker and mark-all-read button', async () => {
    mockUser = asUser('STAFF', themePreference)
    mocked.fetchNotifications.mockResolvedValue({
      unreadCount: 1,
      notifications: [{ id: 'n1', type: 'MENTION', body: 'Hi', read: false, createdAt: '2026-10-30T00:00:00Z' }],
    } as api.NotificationFeed)
    render(withQuery(<NotificationsScreen />))

    await screen.findByText('Mark all as read')
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
    expect(styleOf(screen.getByText('Mark all as read'), 'backgroundColor')).toBe(accent)
    expect(flat(screen.getByTestId('notification-n1-state').props.style).color).toBe(kicker)
  })

  it('shift log screen: kicker and the selected shift', async () => {
    mockUser = asUser('CHEF', themePreference)
    mocked.listShiftLogs.mockResolvedValue([])
    render(withQuery(<ShiftLogsScreen />))

    await screen.findByText('No shift logs yet.')
    expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
    expect(flat(screen.getByLabelText('Morning shift').props.style).borderColor).toBe(accent)
  })
})

describe('boot screen (M020)', () => {
  it('reads its colours from the palette, and is Simple by default (no provider, no user)', () => {
    render(<RootLayout />)

    const text = screen.getByText('Loading KitchenOS...')
    expect(flat(text.props.style).color).toBe(PALETTES.simple.text)
    expect(styleOf(text.parent as never, 'backgroundColor')).toBe(PALETTES.simple.background)
  })

  it('follows the theme store rather than a literal', () => {
    const original = PALETTES['dark-neon'].background
    PALETTES['dark-neon'].background = '#010203'
    try {
      const store: ThemeStore = { ...createThemeStore(), getPreference: () => 'dark-neon' }
      render(
        <ThemeContext.Provider value={store}>
          <RootLayout />
        </ThemeContext.Provider>,
      )

      expect(styleOf(screen.getByText('Loading KitchenOS...').parent as never, 'backgroundColor')).toBe('#010203')
    } finally {
      PALETTES['dark-neon'].background = original
    }
  })
})
