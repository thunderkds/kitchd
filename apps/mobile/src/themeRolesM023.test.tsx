import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native'
import type { StoredUser } from '@kitchenos/shared'
import AnnouncementsScreen from '../app/announcements'
import DashboardScreen from '../app/dashboard'
import ShiftLogsScreen from '../app/shift-logs'
import { AlertWidgets } from './components/AlertWidgets'
import { FieldError } from './components/FormFields'
import { ScreenFrame } from './components/ScreenFrame'
import * as api from './api'
import { createQueryClient } from './queryClient'
import { PALETTES } from './theme'

// M023: the leftover hard-coded mobile colours now come from eight new palette roles. The palette
// comes from useTheme(), which reads the stored user's themePreference (same shape as M020's tests).
const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }
let mockUser: StoredUser | null = null

jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Redirect: () => null }))
jest.mock('./storage', () => ({ clearSession: jest.fn() }))
jest.mock('./session', () => ({
  session: {
    getUser: () => mockUser,
    setUser: (user: StoredUser) => {
      mockUser = user
    },
  },
}))
jest.mock('./api', () => ({
  listAnnouncements: jest.fn(),
  createAnnouncement: jest.fn(),
  fetchNotifications: jest.fn(),
  listShiftLogs: jest.fn(),
  createShiftLog: jest.fn(),
  listLowStock: jest.fn(),
  listExpiringSoon: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []
const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean))

function renderWithQuery(ui: React.ReactElement) {
  const client = createQueryClient()
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { gcTime: Infinity } })
  clients.push(client)
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

// The first ancestor (or the node itself) whose style sets `prop` (Pressable styles live on the host View above its Text).
function styleOf(node: { props: { style?: unknown }; parent: unknown }, prop: string) {
  let current = node as { props: { style?: unknown }; parent: unknown } | null
  while (current) {
    const value = flat(current.props.style)[prop]
    if (value !== undefined) return value
    current = current.parent as typeof current
  }
  return undefined
}

const asUser = (role: StoredUser['role'], themePreference: StoredUser['themePreference']): StoredUser => ({
  id: 'u1',
  email: 'u1@example.com',
  organizationId: 'o',
  kitchenId: 'k',
  role,
  themePreference,
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  mockUser = null
})

const THEMES = ['simple', 'dark-neon'] as const

describe('palette roles (M023 AC1)', () => {
  it('simple pins the eight new roles to the most-used legacy shade of each group', () => {
    expect(PALETTES.simple).toMatchObject({
      inputBackground: '#101521',
      inputBorder: '#2d374b',
      divider: '#222b3a',
      textSecondary: '#ccd5e6',
      hint: '#8f9db4',
      warning: '#ffd27a',
      success: '#93e0a6',
      raised: '#1d2740',
    })
  })

  it('dark-neon pins the eight new roles to Graphite Mint tokens', () => {
    expect(PALETTES['dark-neon']).toMatchObject({
      inputBackground: '#0E100F',
      inputBorder: '#2C3230',
      divider: '#1F2321',
      textSecondary: '#ABB3AE',
      hint: '#8C9590',
      warning: '#E3B66B',
      success: '#7EDDB0',
      raised: '#181B1A',
    })
  })
})

describe('no leftover colour literals (M023 AC2)', () => {
  // Every '#rrggbb' in a non-test mobile source must be listed here with a reason, or it fails the test.
  // theme.ts is the one place palette values live. The two '#ffffff' are the label of the selected row of
  // a selector: white on the raised panel, not on an accent fill, so onAccent (dark on Graphite) would be wrong.
  const ALLOWED: Record<string, Record<string, number>> = {
    'src/theme.ts': { '*': Infinity },
    'app/tasks.tsx': { '#ffffff': 1 },
    'app/task/[taskId].tsx': { '#ffffff': 1 },
  }

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === 'testing' ? [] : sources(path)
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
    })
  }

  it('only the allow-listed literals remain under app/ and src/', () => {
    const root = join(__dirname, '..')
    const offenders: string[] = []
    for (const file of [...sources(join(root, 'app')), ...sources(join(root, 'src'))]) {
      const rel = relative(root, file)
      const found = readFileSync(file, 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
      const counts: Record<string, number> = {}
      for (const literal of found) counts[literal.toLowerCase()] = (counts[literal.toLowerCase()] ?? 0) + 1
      const allowed = ALLOWED[rel] ?? {}
      for (const [literal, count] of Object.entries(counts)) {
        if (count > (allowed['*'] ?? allowed[literal] ?? 0)) offenders.push(`${rel}: ${literal} x${count}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe.each(THEMES)('%s palette applied to screens (M023 AC3, AC4, AC5)', (themePreference) => {
  const p = PALETTES[themePreference]

  it('announcements: inputs, placeholder, secondary text, hint and divider', async () => {
    mockUser = asUser('OWNER', themePreference)
    mocked.listAnnouncements.mockResolvedValue([
      { id: 'a1', title: 'Closed Monday', body: 'Deep clean day', readBy: [], createdAt: '2026-10-30T00:00:00Z' },
    ] as unknown as api.Announcement[])
    renderWithQuery(<AnnouncementsScreen />)

    fireEvent.press(await screen.findByText('New announcement'))
    const title = screen.getByPlaceholderText('Title')
    expect(flat(title.props.style).backgroundColor).toBe(p.inputBackground)
    expect(flat(title.props.style).borderColor).toBe(p.inputBorder)
    expect(title.props.placeholderTextColor).toBe(p.hint)
    expect(screen.getByPlaceholderText('Message').props.placeholderTextColor).toBe(p.hint)

    expect(flat(screen.getByText('Deep clean day').props.style).color).toBe(p.textSecondary)
    expect(styleOf(screen.getByText('Closed Monday'), 'borderTopColor')).toBe(p.divider)
    expect(flat(screen.getByText(/Read the kitchen history/).props.style).color).toBe(p.hint)
    // Cancel is a control: input fill and border.
    expect(styleOf(screen.getByText('Cancel'), 'backgroundColor')).toBe(p.inputBackground)
    expect(styleOf(screen.getByText('Cancel'), 'borderColor')).toBe(p.inputBorder)
  })

  it('dashboard: secondary buttons use the input roles; the unread badge is danger with onAccent text', async () => {
    mockUser = asUser('CHEF', themePreference)
    mocked.fetchNotifications.mockResolvedValue({ notifications: [], unreadCount: 3 })
    mocked.listLowStock.mockResolvedValue([])
    mocked.listExpiringSoon.mockResolvedValue([])
    renderWithQuery(<DashboardScreen />)

    expect(styleOf(screen.getByText('Open tasks'), 'backgroundColor')).toBe(p.inputBackground)
    expect(styleOf(screen.getByText('Open tasks'), 'borderColor')).toBe(p.inputBorder)
    const badge = await screen.findByTestId('notifications-unread-badge')
    expect(flat(badge.props.style).backgroundColor).toBe(p.danger)
    expect(flat(screen.getByText('3').props.style).color).toBe(p.onAccent)
    expect(flat(screen.getByText(/This is the mobile shell landing screen/).props.style).color).toBe(p.hint)
  })

  it('alert widgets: panel, warning row text, critical row text and hint all come from the palette', async () => {
    mockUser = asUser('CHEF', themePreference)
    mocked.listLowStock.mockResolvedValue([
      { id: 'a', name: 'Half', unit: 'kg', minThreshold: 10, currentStock: 5 },
      { id: 'b', name: 'Above half', unit: 'kg', minThreshold: 10, currentStock: 6 },
    ])
    mocked.listExpiringSoon.mockRejectedValue(new Error('boom'))
    renderWithQuery(<AlertWidgets />)

    await screen.findByText('Half')
    expect(flat(screen.getByText('Half').props.style).color).toBe(p.danger)
    expect(flat(screen.getByText('Above half').props.style).color).toBe(p.warning)
    expect(styleOf(screen.getByText('Low Stock'), 'backgroundColor')).toBe(p.inputBackground)
    expect(styleOf(screen.getByText('Low Stock'), 'borderColor')).toBe(p.inputBorder)
    expect(flat(screen.getByText('Low Stock').props.style).color).toBe(p.text)
    expect(flat((await screen.findByText('boom')).props.style).color).toBe(p.danger)
  })

  it('form fields: the shared error text is danger', () => {
    mockUser = asUser('CHEF', themePreference)
    render(<FieldError message="Title is required" />)

    expect(flat(screen.getByText('Title is required').props.style).color).toBe(p.danger)
  })

  it('screen frame: without a background prop it paints the palette background', () => {
    mockUser = asUser('CHEF', themePreference)
    render(
      <ScreenFrame>
        <Text>x</Text>
      </ScreenFrame>,
    )

    expect(StyleSheet.flatten(screen.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor).toBe(p.background)
  })

  it('shift log: the selected shift is a raised panel, the composer a sunken input', async () => {
    mockUser = asUser('CHEF', themePreference)
    mocked.listShiftLogs.mockResolvedValue([])
    renderWithQuery(<ShiftLogsScreen />)

    // Morning is selected by default.
    await screen.findByLabelText('Morning shift')
    expect(flat(screen.getByLabelText('Morning shift').props.style).backgroundColor).toBe(p.raised)
    expect(flat(screen.getByLabelText('Evening shift').props.style).backgroundColor).toBe(p.inputBackground)
    expect(screen.getByLabelText('Shift log body').props.placeholderTextColor).toBe(p.hint)
  })
})
