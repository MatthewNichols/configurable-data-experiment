import { defineConfig } from 'vitest/config';

/** `yarn test:docker` — production-path checks that need Docker: the compiled server on plain node, `cde dump`. */
export default defineConfig({
  test: {
    include: ['packages/*/docker-test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.cde/**', '**/.cde-test/**'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    pool: 'forks',
  },
});
