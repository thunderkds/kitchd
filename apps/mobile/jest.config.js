module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  moduleNameMapper: {
    '^@kitchenos/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
}
