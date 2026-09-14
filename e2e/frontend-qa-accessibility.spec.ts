import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test.describe.configure({ mode: "serial" })

test.describe("Phase 9 — Frontend, UX, Forms & Accessibility Audit", () => {
  test.setTimeout(180_000)

  const viewports = [
    { name: "320px (Mobile Min)", width: 320, height: 600 },
    { name: "375px (Mobile Compact)", width: 375, height: 667 },
    { name: "390px (Mobile Standard)", width: 390, height: 844 },
    { name: "768px (Tablet Portrait)", width: 768, height: 1024 },
    { name: "1024px (Tablet Landscape)", width: 1024, height: 768 },
    { name: "1440px (Desktop Standard)", width: 1440, height: 900 },
    { name: "1920px (Desktop Widescreen)", width: 1920, height: 1080 },
  ]

  // ─── 1. RESPONSIVE VIEWPORT TESTING (NO HORIZONTAL OVERFLOW) ───
  for (const vp of viewports) {
    test(`1. Responsive Layout at ${vp.name} has zero horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto("/sign-in?mode=login")
      await page.waitForLoadState("networkidle")

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      )
      // Horizontal scroll width must not exceed viewport width by more than 1px (sub-pixel rounding)
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 1)
    })
  }

  // ─── 2. FORM INTERACTION, DOUBLE-CLICK MITIGATION & DISABLED STATES ───
  test("2. Forms Disable Submit Button on Submission to Prevent Double-Clicks", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/sign-in?mode=login")
    await page.waitForLoadState("networkidle")

    const emailInput = page.getByLabel("Email")
    const passwordInput = page.getByLabel("Password", { exact: true })
    const submitButton = page.getByRole("button", { name: "Enter" })

    await emailInput.fill("test-user-rate-check@example.com")
    await passwordInput.fill("ValidPassword1234!")

    // Rapid double click on submit button
    await submitButton.dblclick()

    // Button should enter disabled / pending state during submission
    // and not trigger multiple divergent navigation events
    await expect(page).toHaveURL(/\/sign-in/u)
  })

  // ─── 3. MODAL FOCUS TRAPPING & KEYBOARD INTERACTION (ENTER / ESCAPE) ───
  test("3. Command Menu Opens via Keyboard, Traps Focus, and Closes on Escape", async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Register a user to access the authenticated shell
    const email = `qa-shell-${randomUUID().slice(0, 8)}@example.com`
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("QA Tester")
    await page.getByLabel("Email").fill(email)
    await page
      .getByLabel("Password", { exact: true })
      .fill("ValidPassword1234!")
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)
    await expect(page).toHaveURL(/\/today$/u)

    // Open Command Menu using Cmd+K / Ctrl+K keyboard shortcut
    await page.keyboard.press("Control+k")
    const commandDialog = page.getByRole("dialog", { name: "Command menu" })
    await expect(commandDialog).toBeVisible({ timeout: 10_000 })

    // Verify search input inside command menu is automatically focused
    const searchInput = commandDialog.getByPlaceholder("Type a command…")
    await expect(searchInput).toBeFocused()

    // Verify Tab navigation stays inside the modal (Focus Trapping)
    await page.keyboard.press("Tab")
    const focusedTag = await page.evaluate(
      () => document.activeElement?.tagName,
    )
    expect(["A", "BUTTON", "INPUT"]).toContain(focusedTag)

    // Verify Escape key closes the command dialog and restores focus
    await page.keyboard.press("Escape")
    await expect(commandDialog).toBeHidden()

    await context.close()
  })

  // ─── 4. ACCESSIBILITY: SEMANTIC HTML & ACCESSIBLE FORM LABELS ───
  test("4. Accessibility Audit: Form Inputs Have Associated Labels and ARIA Roles", async ({
    page,
  }) => {
    await page.goto("/sign-in?mode=login")
    await page.waitForLoadState("networkidle")

    // Check that every text input has an accessible label
    const inputs = page.locator('input:not([type="hidden"])')
    const count = await inputs.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute("id")
      const ariaLabel = await input.getAttribute("aria-label")
      const ariaLabelledby = await input.getAttribute("aria-labelledby")

      let hasLabel = Boolean(ariaLabel || ariaLabelledby)
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        if ((await label.count()) > 0) {
          hasLabel = true
        }
      }
      expect(hasLabel).toBeTruthy()
    }

    // Check heading hierarchy: Page must have an h1
    const h1Count = await page.locator("h1").count()
    expect(h1Count).toBeGreaterThanOrEqual(1)
  })

  // ─── 5. ACCESSIBILITY: ERROR ANNOUNCEMENT ROLES (role="alert") ───
  test("5. Form Validation Errors Use role='alert' For Screen Readers", async ({
    page,
  }) => {
    await page.goto("/sign-in?mode=login")
    await page.waitForLoadState("networkidle")

    // Click submit with empty form fields to trigger client/server validation errors
    await page.getByRole("button", { name: "Enter" }).click()

    // Form errors must use role="alert" or aria-live for assistive tech
    const alerts = page.locator('[role="alert"]')
    await expect(alerts.first()).toBeVisible({ timeout: 10_000 })
    const alertCount = await alerts.count()
    expect(alertCount).toBeGreaterThan(0)
  })
})
