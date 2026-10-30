import { act, render, screen } from '@testing-library/react-native'
import RootLayout from '../app/_layout'
import * as storage from './storage'

const mockStop = jest.fn()
const mockStartRealtime = jest.fn(() => mockStop)

jest.mock('expo-router', () => ({ Stack: () => null }))
// The factory runs when the import above is hoisted, so the resolver is exposed on the mocked
// module itself rather than through a variable that would still be in its temporal dead zone.
jest.mock('./storage', () => {
  let resolve!: () => void
  const sessionReady = new Promise<void>((r) => {
    resolve = r
  })
  return { sessionReady, __resolveSession: resolve }
})
// The boot screen reads the theme (M020), which reads the session; its real store needs the full storage module.
jest.mock('./session', () => ({ session: { getUser: () => null } }))
jest.mock('./queryClient', () => ({ queryClient: new (require('@tanstack/react-query').QueryClient)() }))
jest.mock('./realtime', () => ({ startRealtime: () => mockStartRealtime() }))

describe('RootLayout realtime hook-up (M009)', () => {
  it('starts realtime only after the session has been read, and stops it on unmount', async () => {
    const view = render(<RootLayout />)

    expect(screen.getByText('Loading KitchenOS...')).toBeTruthy()
    expect(mockStartRealtime).not.toHaveBeenCalled()

    await act(async () => {
      ;(storage as unknown as { __resolveSession: () => void }).__resolveSession()
    })

    expect(mockStartRealtime).toHaveBeenCalledTimes(1)

    view.unmount()

    expect(mockStop).toHaveBeenCalledTimes(1)
  })
})
