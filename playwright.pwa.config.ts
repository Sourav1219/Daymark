import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  testDir: "./pwa-e2e",
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3001",
    serviceWorkers: "allow",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm build && pnpm start --hostname 127.0.0.1 --port 3001",
    reuseExistingServer: false,
    timeout: 180_000,
    url: "http://127.0.0.1:3001/api/health",
  },
})
