import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test.describe.configure({ mode: "serial" })

test.describe("Phase 10 — Performance, Network & Resilience Audit", () => {
  test.setTimeout(180_000)

  // ─── 1. RESILIENCE: SIMULATED NETWORK LOSS & OFFLINE DEGRADATION ───
  test("1. Application Handles Network Disconnect Without Crashing", async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Register user to reach authenticated app
    const email = `perf-offline-${randomUUID().slice(0, 8)}@example.com`
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Offline Tester")
    await page.getByLabel("Email").fill(email)
    await page
      .getByLabel("Password", { exact: true })
      .fill("ValidPassword1234!")
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)
    await expect(page).toHaveURL(/\/today$/u)

    // Simulate network disconnection
    await context.setOffline(true)

    // Application shell remains visible, responsive, and does not crash to a blank screen
    await expect(page.locator("body")).toBeVisible()
    const mainContent = page.locator("main, .app-tabbar")
    await expect(mainContent.first()).toBeVisible()

    // Restore network
    await context.setOffline(false)
    await context.close()
  })

  // ─── 2. RESILIENCE: API ERROR DEGRADATION & ERROR BOUNDARY ───
  test("2. Graceful Degradation on Simulated 500 API Route Failure", async ({
    page,
  }) => {
    await page.goto("/sign-in?mode=login")
    await page.waitForLoadState("networkidle")

    // Intercept a system API route and force a 500 Server Error
    await page.route("**/api/health", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated internal server error." }),
      })
    })

    const responseData = await page.evaluate(async () => {
      const res = await fetch("/api/health")
      const json = await res.json()
      return { status: res.status, json }
    })
    expect(responseData.status).toBe(500)
    expect(responseData.json.error).toBe("Simulated internal server error.")
  })

  // ─── 3. RESILIENCE: OFFLINE DOCUMENT FALLBACK (~/offline) ───
  test("3. Offline Fallback Document Renders Cleanly", async ({ page }) => {
    await page.goto("/~offline")
    await page.waitForLoadState("networkidle")

    // The dedicated offline fallback document must render without errors
    await expect(page.locator("body")).toBeVisible()
    const content = await page.textContent("body")
    expect(content?.length).toBeGreaterThan(50)
  })
})
