import { randomUUID } from "node:crypto"
import { test, expect } from "@playwright/test"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test.describe("Phase 3 - Complete Route, Page & Navigation Audit", () => {
  test.setTimeout(120_000)

  test("1. Public Legal Pages: Direct Open, Refresh, History, and UI Navigation", async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
    })

    const publicRoutes = [
      { path: "/about", headingText: "About" },
      { path: "/contact", headingText: "Contact" },
      { path: "/terms", headingText: "Terms" },
      { path: "/privacy", headingText: "Privacy" },
      { path: "/privacy/policy", headingText: "Policy" },
      { path: "/privacy/inventory", headingText: "Inventory" },
      { path: "/privacy/consent", headingText: "Consent" },
      { path: "/privacy/rights", headingText: "Rights" },
      { path: "/privacy/nominee", headingText: "Nominee" },
      { path: "/~offline", headingText: "Offline" },
    ]

    for (const route of publicRoutes) {
      // Direct opening
      const res = await page.goto(route.path, { waitUntil: "domcontentloaded" })
      expect(res?.status()).toBeLessThan(400)

      // Verify page is not a blank screen
      const bodyText = await page.innerText("body")
      expect(bodyText.trim().length).toBeGreaterThan(50)

      // Refresh
      await page.reload({ waitUntil: "domcontentloaded" })
      const bodyAfterReload = await page.innerText("body")
      expect(bodyAfterReload.trim().length).toBeGreaterThan(50)
    }

    // Test browser back and forward history
    await page.goto("/about", { waitUntil: "domcontentloaded" })
    await page.goto("/contact", { waitUntil: "domcontentloaded" })

    await page.goBack({ waitUntil: "domcontentloaded" })
    await page.waitForURL("**/about*")
    expect(page.url()).toContain("/about")

    await page.goForward({ waitUntil: "domcontentloaded" })
    await page.waitForURL("**/contact*")
    expect(page.url()).toContain("/contact")

    // Filter out expected third-party or network telemetry noise if any
    const realErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("sentry"),
    )
    expect(realErrors).toHaveLength(0)
  })

  test("2. Auth Pages: Direct Open, Dynamic Query Params, Session Expired Messaging", async ({
    page,
  }) => {
    // /sign-in welcome mode
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" })
    expect((await page.title()).toLowerCase()).toContain("sign in")
    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "I already have an account" }),
    ).toBeVisible()

    // /sign-in login mode
    await page.goto("/sign-in?mode=login", { waitUntil: "domcontentloaded" })
    const emailInput = page.getByLabel("Email")
    await expect(emailInput).toBeVisible()

    // /sign-up
    await page.goto("/sign-up", { waitUntil: "domcontentloaded" })
    expect(
      await page.locator("input[name='name'], input[id='name']").count(),
    ).toBeGreaterThan(0)

    // /forgot-password
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" })
    expect((await page.innerText("body")).toLowerCase()).toContain("password")

    // /verify-email
    await page.goto("/verify-email", { waitUntil: "domcontentloaded" })
    expect((await page.innerText("body")).toLowerCase()).toContain(
      "verification",
    )

    // /sign-out without params
    await page.goto("/sign-out", { waitUntil: "domcontentloaded" })
    expect(await page.innerText("body")).toContain("signed out")

    // /sign-out?reason=expired
    await page.goto("/sign-out?reason=expired", {
      waitUntil: "domcontentloaded",
    })
    expect((await page.innerText("body")).toLowerCase()).toContain(
      "session ended",
    )

    // /sign-out?reason=deleted
    await page.goto("/sign-out?reason=deleted", {
      waitUntil: "domcontentloaded",
    })
    expect((await page.innerText("body")).toLowerCase()).toContain(
      "account deleted",
    )

    // /session-expired redirect
    await page.goto("/session-expired", { waitUntil: "domcontentloaded" })
    expect(page.url()).toContain("/sign-out")
    expect(page.url()).toContain("reason=expired")
    expect((await page.innerText("body")).toLowerCase()).toContain(
      "session ended",
    )

    // /unauthorized redirect
    await page.goto("/unauthorized", { waitUntil: "domcontentloaded" })
    expect(page.url()).toContain("/sign-out")
    expect(page.url()).toContain("reason=expired")
  })

  test("3. 404 Page Behavior, Deep Links & Recovery CTAs", async ({ page }) => {
    const res = await page.goto("/totally-nonexistent-path-abc-123", {
      waitUntil: "domcontentloaded",
    })
    expect(res?.status()).toBe(404)
    expect(await page.innerText("body")).toContain("We can’t find that page")

    // Test recovery CTA
    const homeLink = page.locator("a[href='/sign-in']").first()
    await homeLink.click()
    await page.waitForURL("**/sign-in*")
    expect(page.url()).toContain("/sign-in")
  })

  test("4. Protected Route Guards: Bypassed Direct Navigation Prevention", async ({
    page,
  }) => {
    const protectedPaths = [
      "/today",
      "/quests",
      "/cleared",
      "/gates",
      "/timer",
      "/progress",
      "/profile",
      "/settings",
      "/settings/privacy-data",
      "/app",
      "/app/workspaces/00000000-0000-0000-0000-000000000001",
    ]

    for (const path of protectedPaths) {
      await page.goto(path, { waitUntil: "domcontentloaded" })
      expect(page.url()).toContain("/sign-in")
      expect(page.url()).toContain("next=")
      expect(page.url()).toContain(encodeURIComponent(path).slice(0, 10))
    }
  })

  test("5. Authenticated App Navigation, Shell Layout, and History Traversal", async ({
    page,
  }) => {
    const email = `audit-${randomUUID()}@example.com`
    const password = "audit-password-123!"

    // Start at /app to trigger redirect to /sign-in
    await page.goto("/app")
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/u)

    // Switch to sign-up mode and register
    await page.getByRole("button", { name: "Get started" }).click()
    await page.getByLabel("Name").fill("Audit Lead")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)

    // Expect entrance into Today
    await expect(page).toHaveURL(/\/today$/u)

    // Test navigation between protected views
    const protectedViews = [
      { name: "Quests", path: "/quests" },
      { name: "Cleared", path: "/cleared" },
      { name: "Gates", path: "/gates" },
      { name: "Timer", path: "/timer" },
      { name: "Progress", path: "/progress" },
      { name: "Profile", path: "/profile" },
      { name: "Settings", path: "/settings" },
    ]

    for (const view of protectedViews) {
      await page.goto(view.path, { waitUntil: "domcontentloaded" })
      expect(page.url()).toContain(view.path)

      // Content check
      const bodyText = await page.innerText("body")
      expect(bodyText).not.toContain(
        "Application error: a client-side exception has occurred",
      )
      expect(bodyText.trim().length).toBeGreaterThan(100)

      // Reload check
      await page.reload({ waitUntil: "domcontentloaded" })
      expect(page.url()).toContain(view.path)
    }

    // Verify Settings page contains Reminder preferences
    await page.goto("/settings", { waitUntil: "domcontentloaded" })
    const settingsBody = await page.innerText("body")
    expect(settingsBody).toContain("Reminder")

    // Verify Profile page contains Settings link and navigate through it by expanding accordion
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    const helpSummary = page.locator(".profile-help-settings__trigger")
    await expect(helpSummary).toBeVisible()
    await helpSummary.click()

    const settingsLink = page.locator("a[href='/settings']")
    await expect(settingsLink).toBeVisible()
    await settingsLink.click()
    await page.waitForURL("**/settings*")
    expect(page.url()).toContain("/settings")

    // Test forbidden workspace boundary
    await page.goto(`/app/workspaces/${randomUUID()}`)
    await expect(
      page.getByRole("heading", {
        name: "This workspace is outside your access boundary.",
      }),
    ).toBeVisible()

    // Test Browser Back and Forward in authenticated state
    const timerLink = page.locator("a[href='/timer']").first()
    await timerLink.click()
    await page.waitForURL("**/timer*")
    expect(page.url()).toContain("/timer")

    const todayLink = page.locator("a[href='/today']").first()
    await todayLink.click()
    await page.waitForURL("**/today*")
    expect(page.url()).toContain("/today")

    await page.goBack()
    await page.waitForURL("**/timer*")
    expect(page.url()).toContain("/timer")

    await page.goForward()
    await page.waitForURL("**/today*")
    expect(page.url()).toContain("/today")

    // Logout
    await page.getByRole("link", { name: "Profile" }).click()
    await page.getByRole("button", { name: "Log out" }).click()
    await expect(page).toHaveURL(/\/sign-out\?next=%2Ftoday$/u)
  })
})
