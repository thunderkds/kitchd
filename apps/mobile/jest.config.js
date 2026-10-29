module.exports = {
  preset: 'jest-expo',
  // Cold transform caches make the first test of the heavy screen suites exceed the 5s default.
  testTimeout: 15000,
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  moduleNameMapper: {
    '^@kitchenos/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
}
