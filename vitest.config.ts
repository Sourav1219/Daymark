import { resolve } from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "src"),
      "server-only": resolve(process.cwd(), "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "pwa-e2e/**", "node_modules/**", ".next/**"],
    fileParallelism: false,
    // Minimal server env so modules that read the validated server
    // configuration (e.g. the canonical CSRF origin) behave deterministically
    // under test without depending on developer machine state.
    env: {
      BETTER_AUTH_SECRET: "vitest-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "https://vitest.example.test",
      DATABASE_URL: "postgresql://vitest:vitest@example.test/vitest",
    },
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
})
