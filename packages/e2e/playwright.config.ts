import { defineConfig, devices } from "@playwright/test";

// E2E 전용 포트 (dev 서버와 충돌 없음)
const INGEST_URL = "http://localhost:3101";
const VIZ_URL = "http://localhost:5210";
const ROLEPLAY_URL = "http://localhost:5211";
const SHOP_URL = "http://localhost:5220";
const REGISTRY_UI_URL = "http://localhost:5230";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // WS 간섭 방지
  retries: process.env["CI"] ? 2 : 0,
  timeout: 40_000,

  use: {
    baseURL: VIZ_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // DB 없이 인메모리 스토어로 구동
      command:
        "pnpm --filter @qa-sdk/ingest-server exec tsx src/test-server.ts",
      url: `${INGEST_URL}/health`,
      reuseExistingServer: !process.env["CI"],
      timeout: 15_000,
      env: { PORT: "3101" },
    },
    {
      command: "pnpm --filter @qa-sdk/viz-web exec vite --port 5210",
      url: VIZ_URL,
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
      env: {
        VITE_INGEST_SERVER_URL: INGEST_URL,
        VITE_ROLEPLAY_WEB_URL: ROLEPLAY_URL,
      },
    },
    {
      command: "pnpm --filter @qa-sdk/roleplay-web exec vite --port 5211",
      url: ROLEPLAY_URL,
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
      env: {
        VITE_INGEST_SERVER_URL: INGEST_URL,
        VITE_VIZ_WEB_ORIGIN: VIZ_URL,
      },
    },
    {
      command: "pnpm --filter @qa-sdk/shop-web start",
      url: SHOP_URL,
      reuseExistingServer: !process.env["CI"],
      timeout: 15_000,
    },
    {
      command:
        "cd ../.. && pnpm --filter @qa-sdk/cli build && node packages/cli/dist/index.js git conflicts --root . --skip-fetch --max-commits 12 --output packages/registry-ui/public/__generated__/git-conflicts.e2e.json && pnpm --filter @qa-sdk/registry-ui exec vite --port 5230",
      url: REGISTRY_UI_URL,
      reuseExistingServer: false,
      timeout: 40_000,
      env: {
        VITE_GIT_CONFLICTS_REPORT_PATH: "/__generated__/git-conflicts.e2e.json",
      },
    },
  ],
});
