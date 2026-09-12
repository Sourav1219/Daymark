import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  testDir: "./pwa-e2e",
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3001",
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
    serviceWorkers: "allow",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm build && pnpm start --hostname 127.0.0.1 --port 3001",
    env: {
      ...process.env,
      BETTER_AUTH_URL: "http://127.0.0.1:3001",
      E2E_TEST_MODE: "true",
      NEXT_DIST_DIR: ".next-pwa-e2e",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3001",
      NEXT_PUBLIC_E2E_TEST_MODE: "true",
      UPSTASH_REDIS_REST_TOKEN: "",
      UPSTASH_REDIS_REST_URL: "",
    },
    reuseExistingServer: false,
    timeout: 180_000,
    url: "http://127.0.0.1:3001/api/health",
  },
})
