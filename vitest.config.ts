import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'modules/*/test/**/*.test.ts', 'customers/*/test/**/*.test.ts', 'customers/*/modules/*/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.cde/**', '**/.cde-test/**'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    pool: 'forks',
  },
});
