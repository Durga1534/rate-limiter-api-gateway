/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@prisma|prisma)/)'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@prisma/client$': '<rootDir>/tests/mocks/prismaMock.ts',
    '^prisma\\.ts$': '<rootDir>/tests/mocks/prismaMock.ts',
    '^uuid$': '<rootDir>/tests/mocks/uuidMock.ts',
    '^redis\\.ts$': '<rootDir>/tests/mocks/redisMock.ts',
    '^logger\\.ts$': '<rootDir>/tests/mocks/loggerMock.ts',
    '^swagger-ui-express$': '<rootDir>/tests/mocks/swaggerMock.ts',
    '^@sentry/node$': '<rootDir>/tests/mocks/sentryMock.ts'
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!node_modules/**',
    '!generated/**',
    '!tests/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
