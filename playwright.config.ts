import { defineConfig, devices } from '@playwright/test'

const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? '3010'
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? '4000'
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${webPort}`
const apiURL =
  process.env.PLAYWRIGHT_API_URL ?? `http://127.0.0.1:${apiPort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 20_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'npm run dev:api',
          url: `${apiURL}/health`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: `npx next dev --webpack -p ${webPort}`,
          cwd: 'apps/web',
          url: baseURL,
          // Ne pas réutiliser un autre projet déjà sur :3000.
          reuseExistingServer: false,
          timeout: 180_000,
          env: {
            ...process.env,
            API_PROXY_TARGET: apiURL,
            NEXT_DEV_ORIGIN: baseURL,
          },
        },
      ],
})
