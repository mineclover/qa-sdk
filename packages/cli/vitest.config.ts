import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 30_000,
    // docs/DB integration tests scan the repository; avoid fork storms in CI.
    maxWorkers: 4,
    minWorkers: 1,
    pool: 'forks',
    testTimeout: 30_000,
  },
});
