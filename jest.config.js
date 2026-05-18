/**
 * Root Jest config — runs unit tests across the monorepo.
 *
 * Uses @swc/jest for transformation. SWC handles both .ts and .js files,
 * including ESM-only deps like `jose` v6+, without ts-jest's CJS limitations.
 *
 * Test files live under each workspace's `tests/` folder mirroring `src/`:
 *   shared/<pkg>/tests/**\/*.spec.ts
 *   apps/<svc>/tests/**\/*.spec.ts
 *
 * Run all:               npm test
 * Single file:           npx jest <path>
 * Watch:                 npm run test:watch
 * Coverage:              npm run test:coverage
 */
// Disable file logging during tests to avoid parallel worker conflicts
process.env.LOG_TARGET = process.env.LOG_TARGET || 'console';

module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/shared/*/tests/**/*.spec.ts',
    '<rootDir>/apps/*/tests/**/*.spec.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/src/generated/',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(t|j)s$': ['@swc/jest', {
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        target: 'es2021',
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
      },
    }],
  },
  // Force jest to transform ESM-only deps instead of ignoring them.
  transformIgnorePatterns: [
    '/node_modules/(?!(jose)/)',
  ],
  moduleNameMapper: {
    // Resolve @package/* to in-repo source so tests don't need a build first.
    '^@package/bootstrap$': '<rootDir>/shared/bootstrap/src/index.ts',
    '^@package/common$': '<rootDir>/shared/common/src/index.ts',
    '^@package/config$': '<rootDir>/shared/config/src/index.ts',
    '^@package/redis$': '<rootDir>/shared/redis/src/index.ts',
    '^@package/kafka-client$': '<rootDir>/shared/kafka-client/src/index.ts',
    '^@package/rabbitmq-client$': '<rootDir>/shared/rabbitmq-client/src/index.ts',
    '^@package/tracing$': '<rootDir>/shared/tracing/src/index.ts',
    '^@package/circuit-breaker$': '<rootDir>/shared/circuit-breaker/src/index.ts',
    '^@package/shared-types$': '<rootDir>/shared/shared-types/src/index.ts',
    // isomorphic-dompurify pulls in jsdom + a long ESM-only dep tree
    // (@exodus/bytes, whatwg-*, etc.). For unit tests we don't exercise
    // the sanitizer — stub it with an identity passthrough.
    '^isomorphic-dompurify$': '<rootDir>/shared/common/tests/__mocks__/isomorphic-dompurify.ts',
  },
  collectCoverageFrom: [
    'shared/*/src/**/*.ts',
    'apps/*/src/**/*.ts',
    '!**/*.spec.ts',
    '!**/main.ts',
    '!**/*.module.ts',
    '!**/*.dto.ts',
    '!**/dist/**',
    '!**/src/generated/**',
  ],
  coverageDirectory: 'coverage',
};
