// In-memory stand-in for `expo-secure-store`, used only by jest tests.
export function createMemorySecureStore() {
  const data = new Map<string, string>()

  const store = {
    data,
    getItemAsync: jest.fn<Promise<string | null>, [string]>(),
    setItemAsync: jest.fn<Promise<void>, [string, string]>(),
    deleteItemAsync: jest.fn<Promise<void>, [string]>(),
    /** Clears stored values, call history, and any per-test overrides. */
    reset() {
      data.clear()
      store.getItemAsync.mockReset().mockImplementation(async (key) => data.get(key) ?? null)
      store.setItemAsync.mockReset().mockImplementation(async (key, value) => {
        data.set(key, value)
      })
      store.deleteItemAsync.mockReset().mockImplementation(async (key) => {
        data.delete(key)
      })
    },
  }

  store.reset()
  return store
}
