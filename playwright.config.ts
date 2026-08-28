import { defineConfig, devices } from "@playwright/test"

const PORT = process.env.PORT ?? "3000"
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  testMatch: "auth-cms.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "bun run start" : "bun run build && bun run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          ...process.env,
          PORT,
          HOSTNAME: "127.0.0.1",
        },
      },
})
