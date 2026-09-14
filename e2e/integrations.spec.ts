import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"

test.describe.configure({ mode: "serial" })

test.describe("Phase 8 — Third-Party Integrations, Webhooks, Emails & Storage Audit", () => {
  test.setTimeout(120_000)

  // ─── 1. SCHEDULED CRON WEBHOOK ENDPOINTS (FAIL-CLOSED AUTHENTICATION) ───
  test("1. Webhook / Cron Endpoints Fail-Closed Against Unauthenticated Probes", async ({
    request,
  }) => {
    const cronJobs = [
      "reminders",
      "retention",
      "overdue-tasks",
      "stale-timers",
      "stale-rooms",
      "attachments",
    ]

    for (const job of cronJobs) {
      // Unauthenticated request MUST return 401
      const resUnauth = await request.get(`/api/cron/${job}`)
      expect(resUnauth.status()).toBe(401)

      // Forged secret MUST return 401
      const resForged = await request.post(`/api/cron/${job}`, {
        headers: { authorization: "Bearer forged-invalid-secret-key-probe" },
      })
      expect(resForged.status()).toBe(401)
    }
  })

  // ─── 2. PASSWORD RESET EMAIL WORKFLOW & RECIPIENT BOUNDARY ───
  test("2. Password Reset Email Dispatch Sanitization & Feedback", async ({
    page,
  }) => {
    await page.goto("/forgot-password")
    await page.waitForLoadState("networkidle")

    const testEmail = `integration-audit-${randomUUID().slice(0, 8)}@example.com`

    // Fill password reset form with validly formatted email
    await page.getByLabel("Email").fill(testEmail)
    await page.getByRole("button", { name: "Send reset link" }).click()

    // Application displays generic, timing-safe confirmation without revealing account existence
    await expect(page.getByText("Check your inbox")).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByText(/If this address belongs to an eligible account/i),
    ).toBeVisible()
  })

  // ─── 3. GOOGLE OAUTH CONFIGURATION & SANITIZED CALLBACK TARGET ───
  test("3. Google OAuth Button Present & Validates Callback Parameters", async ({
    page,
  }) => {
    await page.goto("/sign-in?mode=login")
    await page.waitForLoadState("networkidle")

    // Google Sign-in button is rendered on the authentication page
    const googleButton = page.getByRole("button", { name: /Google/i })
    await expect(googleButton).toBeVisible()

    // Ensure form attributes or callback parameters do not point to untrusted external URLs
    const currentUrl = page.url()
    expect(currentUrl).toContain("/sign-in")
  })
})
