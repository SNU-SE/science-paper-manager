const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

// Integration test specific configuration
const integrationJestConfig = {
  displayName: 'Integration Tests',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node', // Use node environment for integration tests
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.integration.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/services/__tests__/system-integration.test.ts',
    '<rootDir>/src/services/__tests__/performance.test.ts'
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'src/services/**/*.{js,jsx,ts,tsx}',
    'src/lib/**/*.{js,jsx,ts,tsx}',
    'src/middleware/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/integration',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  testTimeout: 60000, // 60 seconds for integration tests
  maxWorkers: process.env.CI ? 2 : '50%', // Limit workers in CI
  
  // Global setup and teardown for integration tests
  globalSetup: '<rootDir>/jest.integration.setup.js',
  globalTeardown: '<rootDir>/jest.integration.teardown.js',
  
  // Environment variables for tests
  setupFiles: ['<rootDir>/jest.integration.env.js'],
  
  // Verbose output for debugging
  verbose: process.env.VERBOSE_TESTS === 'true',
  
  // Retry failed tests
  retry: process.env.CI ? 2 : 0,
  
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Custom reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-reports',
      outputName: 'integration-test-results.xml',
      suiteName: 'Integration Tests'
    }],
    ['jest-html-reporters', {
      publicPath: 'test-reports',
      filename: 'integration-test-report.html',
      expand: true
    }]
  ]
}

module.exports = createJestConfig(integrationJestConfig)