import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react-native'
import GuidelinesScreen from '../app/guidelines'
import * as api from './api'
import { createQueryClient } from './queryClient'
import { expectSafeAreaAndKeyboardAvoidance } from './testing/nativeFrame'

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() }

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('./session', () => ({
  session: { getUser: () => ({ id: 'u1', email: 'chef@example.com', role: 'CHEF' }) },
}))
jest.mock('./api', () => ({
  listGuidelines: jest.fn(),
  createGuideline: jest.fn(),
  updateGuideline: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const clients: ReturnType<typeof createQueryClient>[] = []

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  for (const fn of Object.values(mocked).filter(jest.isMockFunction)) {
    ;(fn as jest.Mock).mockReset()
  }
})

describe('GuidelinesScreen native quality (M010)', () => {
  it('AC2 + AC3: sits in the safe area and avoids the keyboard', async () => {
    mocked.listGuidelines.mockResolvedValue([])
    const client = createQueryClient()
    clients.push(client)
    render(
      <QueryClientProvider client={client}>
        <GuidelinesScreen />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Guidelines')).toBeTruthy()
    await screen.findByText('New guideline')
    expectSafeAreaAndKeyboardAvoidance()
  })
})
