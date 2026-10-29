// expo's winter runtime installs `fetch` as a lazy getter that requires the native
// ExpoFetchModule on first read. Jest's environment teardown reads every global, which fires
// the getter after tests are done and logs a warning ("Cannot log after tests are done"),
// which makes jest exit 1. Replace the lazy getter with a plain stub; these tests make no
// network calls.
Object.defineProperty(globalThis, 'fetch', {
  value: () => Promise.reject(new Error('fetch is not available in mobile unit tests')),
  writable: true,
  configurable: true,
})

// FlashList cannot measure itself under jest (no native layout), so every row would be virtualized away.
// Plain functions, not jest.fn: a test's jest.restoreAllMocks() would wipe a jest.fn implementation.
// The measurement helpers are stubbed with a phone-sized viewport and 100px rows; the real FlashList renders.
// (@shopify/flash-list/jestSetup is not usable here: in 2.0.2 it replaces FlashList with an export that does not exist.)
jest.mock('@shopify/flash-list/dist/recyclerview/utils/measureLayout', () => ({
  ...jest.requireActual('@shopify/flash-list/dist/recyclerview/utils/measureLayout'),
  measureParentSize: () => ({ x: 0, y: 0, width: 400, height: 900 }),
  measureFirstChildLayout: () => ({ x: 0, y: 0, width: 400, height: 900 }),
  measureItemLayout: () => ({ x: 0, y: 0, width: 100, height: 100 }),
}))
