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
