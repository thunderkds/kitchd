module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  moduleNameMapper: {
    '^@kitchenos/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
}
