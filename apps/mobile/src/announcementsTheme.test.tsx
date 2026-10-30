import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react-native'
import type { StoredUser } from '@kitchenos/shared'
import AnnouncementsScreen from '../app/announcements'
import * as api from './api'
import { createQueryClient } from './queryClient'
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
jest.mock('./api', () => ({ listAnnouncements: jest.fn(), createAnnouncement: jest.fn() }))

const mocked = api as jest.Mocked<typeof api>
const client = createQueryClient()
const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean))

afterEach(() => {
  cleanup()
  client.clear()
})

it.each([
  ['simple', '#0d1016', '#86a0ff'],
  ['dark-neon', '#121413', '#7EDDB0'],
] as const)('announcements list screen uses the %s palette (M006 AC3): background %s, kicker %s', async (themePreference, background, kicker) => {
  mockUser = { id: 'u1', email: 'a@b.c', organizationId: 'o', kitchenId: 'k', role: 'STAFF', themePreference }
  mocked.listAnnouncements.mockResolvedValue([])
  render(
    <QueryClientProvider client={client}>
      <AnnouncementsScreen />
    </QueryClientProvider>,
  )

  expect(flat(screen.getByTestId('announcements-screen').props.style).backgroundColor).toBe(background)
  expect(flat(screen.getByText('KitchenOS mobile').props.style).color).toBe(kicker)
  await screen.findByText('Announcements')
})

it.each([
  ['simple', '#ffffff'],
  ['dark-neon', '#0E100F'],
] as const)('announcements: text on the primary button follows the %s palette (M022 AC2)', async (themePreference, text) => {
  mockUser = { id: 'u1', email: 'a@b.c', organizationId: 'o', kitchenId: 'k', role: 'OWNER', themePreference }
  mocked.listAnnouncements.mockResolvedValue([])
  render(
    <QueryClientProvider client={client}>
      <AnnouncementsScreen />
    </QueryClientProvider>,
  )

  await screen.findByText('No announcements yet.')
  expect(flat(screen.getByText('New announcement').props.style).color).toBe(text)
})

it('announcements screen sits in the safe area and avoids the keyboard (M010 AC2 + AC3)', async () => {
  mockUser = { id: 'u1', email: 'a@b.c', organizationId: 'o', kitchenId: 'k', role: 'OWNER' }
  mocked.listAnnouncements.mockResolvedValue([])
  render(
    <QueryClientProvider client={client}>
      <AnnouncementsScreen />
    </QueryClientProvider>,
  )

  await screen.findByText('No announcements yet.')
  expectSafeAreaAndKeyboardAvoidance()
})
