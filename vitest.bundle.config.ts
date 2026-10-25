import { defineConfig } from 'vitest/config';

/** `yarn test:bundle` — compiles each customer's server and runs it on plain node (slow; needs Docker). */
export default defineConfig({
  test: {
    include: ['packages/*/bundle-test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.cde/**', '**/.cde-test/**'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    pool: 'forks',
  },
});
