import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test.describe.configure({ mode: "serial" })

test.describe("Phase 6 — Deep Security & OWASP Audit", () => {
  test.setTimeout(120_000)

  const email = `owasp-user-${randomUUID().slice(0, 8)}@example.com`
  const password = "ValidPassword1234!"

  // ─── 1. XSS & SCRIPT INJECTION DEFENSE IN DOM RENDERING ───
  test("1. Stored & DOM XSS Defense: Script Tags Rendered As Literal Text", async ({
    page,
  }) => {
    // Ensure the XSS indicator is tracked across all navigations
    await page.addInitScript(() => {
      ;(window as unknown as { __xss_triggered?: boolean }).__xss_triggered =
        false
    })

    // Register user
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("XSS Auditor")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)

    await expect(page).toHaveURL(/\/today$/u)

    // Navigate to /quests and submit task with XSS payload
    await page.goto("/quests")
    await page.waitForLoadState("networkidle")

    const xssTitle = `<script>window.__xss_triggered=true</script><img src=x onerror="window.__xss_triggered=true">Task_${randomUUID().slice(0, 4)}`

    const createForm = page.locator("form", {
      has: page.getByRole("button", { name: "Create Task" }),
    })
    await createForm.getByLabel("Task title").fill(xssTitle)
    await createForm.getByRole("button", { name: "Create Task" }).click()

    // Confirm dialog dismiss and check task card in DOM
    await page
      .getByRole("dialog", { name: "Task created!" })
      .getByRole("link", { name: "Continue" })
      .click()
    await page.waitForURL("**/today*")

    // The XSS string must be rendered as literal text
    const textNode = page.getByText(xssTitle).first()
    await expect(textNode).toBeVisible({ timeout: 15_000 })

    // Verify script was NOT executed
    const wasTriggered = await page.evaluate(
      () =>
        (window as unknown as { __xss_triggered?: boolean }).__xss_triggered,
    )
    expect(wasTriggered).toBe(false)
  })

  // ─── 2. OPEN REDIRECT DEFENSE IN AUTHENTICATION FLOWS ───
  test("2. Open Redirect Defense: External Targets Neutralized to /today", async ({
    page,
  }) => {
    // Attempt visiting sign-in with malicious external redirect parameter in login mode
    const maliciousUrl = "https://attacker.evil.com/phishing"
    await page.goto(
      `/sign-in?mode=login&next=${encodeURIComponent(maliciousUrl)}`,
    )
    await page.waitForLoadState("networkidle")

    // Verify the hidden 'next' input field was sanitized server-side to '/today'
    const nextInput = page.locator('input[name="next"]')
    await expect(nextInput).toHaveValue("/today")
    expect(await nextInput.getAttribute("value")).toBe("/today")
  })

  // ─── 3. CLICKJACKING & FRAME PROTECTION ───
  test("3. Clickjacking Defense: Frame Headers Deny Embedding", async ({
    request,
  }) => {
    const res = await request.get("/sign-in")
    const headers = res.headers()

    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    )
  })
})
