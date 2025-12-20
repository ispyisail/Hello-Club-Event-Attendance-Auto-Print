module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: ['**/tests/**/*.test.js'],

  // Coverage configuration
  collectCoverage: false, // Only collect when explicitly requested with --coverage
  collectCoverageFrom: [
    'src/**/*.js',
    'service/**/*.js',
    '!src/index.js', // Entry point, harder to test
    '!**/node_modules/**',
    '!**/bin/**',
    '!**/dist/**',
  ],

  // Coverage thresholds - gradually increase as tests are added
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 60,
      statements: 60,
    },
    // Stricter thresholds for already-tested modules
    './src/core/functions.js': {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    },
    './src/services/pdf-generator.js': {
      branches: 70,
      functions: 80,
      lines: 75,
      statements: 75,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json'],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Test timeout (10 seconds)
  testTimeout: 10000,
};
