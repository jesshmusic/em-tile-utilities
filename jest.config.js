/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/main.ts', // Entry point with hooks - integration test territory
    '!src/dialogs/base-trap-dialog.ts', // Complex UI base class - hard to unit test
    '!src/dialogs/trap-dialog.ts', // Complex UI with lots of DOM manipulation
    '!src/dialogs/check-state-dialog.ts', // Complex experimental UI feature
    '!src/dialogs/combat-trap-dialog.ts', // Complex UI with drag-and-drop
    '!src/dialogs/activating-trap-dialog.ts' // Complex UI with tile selection
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  verbose: true
};
