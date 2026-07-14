import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['source'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['dist/**'],
    passWithNoTests: true,
    // Nest dashboard integration tests cold-start the catalog and SQLite runtime.
    testTimeout: 15_000,
  },
});
