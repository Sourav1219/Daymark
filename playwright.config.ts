import { defineConfig, devices } from "@playwright/test"

const port = process.env.PLAYWRIGHT_PORT ?? "3000"
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: "./e2e",
  expect: { timeout: 15_000 },
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    storageState: {
      cookies: [
        {
          domain: "127.0.0.1",
          expires: -1,
          httpOnly: false,
          name: "traketo_cookie_consent",
          path: "/",
          sameSite: "Lax",
          secure: false,
          value: "v1.essential",
        },
      ],
      origins: [],
    },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    env: {
      ...process.env,
      E2E_TEST_MODE: "true",
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_E2E_TEST_MODE: "true",
      // Keep local browser runs deterministic and exercise the polling
      // fallback without consuming shared Upstash quotas from .env files.
      UPSTASH_REDIS_REST_TOKEN: "",
      UPSTASH_REDIS_REST_URL: "",
    },
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
