import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const monorepoRoot = resolve(__dirname, '../..')

export default defineConfig({
  testDir: './test/e2e',
  testMatch: /.*\.test\.ts$/,
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4300',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // serve from monorepo root so fixtures can reference vendor/ and packages/ via absolute paths
    command: `npx http-server "${monorepoRoot}" -p 4300 -s -c-1`,
    url: 'http://localhost:4300/packages/visbug-bridge/test/e2e/fixtures/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
