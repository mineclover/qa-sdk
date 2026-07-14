import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/extension',
  testMatch: /.*\.test\.ts$/,
  timeout: 30000,
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
