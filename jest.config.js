/**
 * Root Jest config — runs unit tests across the monorepo.
 *
 * Uses @swc/jest for transformation. SWC handles both .ts and .js files,
 * including ESM-only deps like `jose` v6+, without ts-jest's CJS limitations.
 *
 * Test files live under each workspace's `tests/` folder mirroring `src/`:
 *   packages/<pkg>/tests/**\/*.spec.ts
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
    '<rootDir>/packages/*/tests/**/*.spec.ts',
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
  // Force jest to transform ESM-only deps (jose) instead of ignoring them.
  // The negative lookahead at line start excludes any path containing
  // a jose package segment ("/jose/", "/jose@", "\jose\", or "\jose@"),
  // so it handles both npm-flat and pnpm-nested (node_modules/.pnpm/jose@x.y.z/...)
  // layouts on either separator.
  transformIgnorePatterns: [
    '^(?!.*[/\\\\]jose([/\\\\@]|$)).*node_modules',
  ],
  moduleNameMapper: {
    // Resolve @package/* to in-repo source so tests don't need a build first.
    '^@package/bootstrap$': '<rootDir>/packages/bootstrap/src/index.ts',
    '^@package/common$': '<rootDir>/packages/common/src/index.ts',
    '^@package/config$': '<rootDir>/packages/config/src/index.ts',
    '^@package/redis$': '<rootDir>/packages/redis/src/index.ts',
    '^@package/kafka-client$': '<rootDir>/packages/kafka-client/src/index.ts',
    '^@package/rabbitmq-client$': '<rootDir>/packages/rabbitmq-client/src/index.ts',
    '^@package/tracing$': '<rootDir>/packages/tracing/src/index.ts',
    '^@package/circuit-breaker$': '<rootDir>/packages/circuit-breaker/src/index.ts',
    '^@package/shared-types$': '<rootDir>/packages/shared-types/src/index.ts',
    // isomorphic-dompurify pulls in jsdom + a long ESM-only dep tree
    // (@exodus/bytes, whatwg-*, etc.). For unit tests we don't exercise
    // the sanitizer — stub it with an identity passthrough.
    '^isomorphic-dompurify$': '<rootDir>/packages/common/tests/__mocks__/isomorphic-dompurify.ts',
  },
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
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
