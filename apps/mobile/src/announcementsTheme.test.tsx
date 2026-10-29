import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react-native'
import type { StoredUser } from '@kitchenos/shared'
import AnnouncementsScreen from '../app/announcements'
import * as api from './api'
import { createQueryClient } from './queryClient'

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
  ['dark-neon', '#0d1016', '#ff6b8b'],
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
