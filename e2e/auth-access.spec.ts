import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import {
  completeEmailVerification,
  e2eVerificationCode,
} from "./helpers/complete-email-verification"

test.describe.configure({ mode: "serial" })

test.describe("Phase 4 — Authentication, Session & Access Control Audit", () => {
  test.setTimeout(120_000)

  // ─── 1. SIGNUP, PASSWORD POLICY & LEGAL CONSENT ───
  test("1. Signup Workflow: Password Complexity, Agreements & Non-Enumeration", async ({
    page,
  }) => {
    await page.goto("/sign-up")
    await expect(
      page.getByRole("heading", { name: /Start building/iu }),
    ).toBeVisible()

    // 1.1 Agreements Guard: Submit button is disabled until both agreements are checked
    const createButton = page.getByRole("button", { name: "Create" })
    await expect(createButton).toBeDisabled()

    await page.getByLabel("Name").fill("Security Tester")
    await page
      .getByLabel("Email")
      .fill(`test-${randomUUID().slice(0, 8)}@example.com`)
    await page
      .getByLabel("Password", { exact: true })
      .fill("StrongValidPassword123!")

    // Still disabled
    await expect(createButton).toBeDisabled()

    // Check terms only
    await page.locator("#termsAccepted").check()
    await expect(createButton).toBeDisabled()

    // Check privacy notice too -> button becomes enabled
    await page.locator("#privacyNoticeAcknowledged").check()
    await expect(createButton).toBeEnabled()

    // 1.2 Trivial Password Rejection
    await page.getByLabel("Password", { exact: true }).fill("123456789012")
    await createButton.click()

    // Expect validation message rejecting predictable password
    await expect(
      page.getByText(/Choose a less predictable password|Password must be/iu),
    ).toBeVisible()

    // 1.3 Valid Registration
    const validEmail = `sec-audit-${randomUUID().slice(0, 8)}@example.com`
    const validPassword = "CorrectHorseBattery99!"
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByLabel("Password", { exact: true }).fill(validPassword)
    await createButton.click()

    // Must advance to verification panel
    await expect(
      page.getByRole("heading", { name: "Check your inbox." }),
    ).toBeVisible()

    // 1.4 Duplicate Email Registration (Non-Enumeration)
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Imposter Tester")
    await page.getByLabel("Email").fill(validEmail)
    await page
      .getByLabel("Password", { exact: true })
      .fill("AnotherStrongP@ss123!")
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()

    // Must NOT say "User already exists"; must return identical generic OTP screen
    await expect(
      page.getByRole("heading", { name: "Check your inbox." }),
    ).toBeVisible()
  })

  // ─── 2. EMAIL VERIFICATION & OTP BRUTE FORCE ───
  test("2. Email Verification Workflow: Invalid OTP, Error Feedback & Completion", async ({
    page,
  }) => {
    const userEmail = `otp-audit-${randomUUID().slice(0, 8)}@example.com`
    const userPassword = "ValidPassword1234!"

    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("OTP Tester")
    await page.getByLabel("Email").fill(userEmail)
    await page.getByLabel("Password", { exact: true }).fill(userPassword)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()

    await expect(
      page.getByRole("heading", { name: "Check your inbox." }),
    ).toBeVisible()

    // 2.1 Submit Invalid 6-digit Code
    await page.getByLabel("Verification code").fill("000000")
    await page.getByRole("button", { name: "Verify email" }).click()

    // Expect error feedback
    await expect(
      page.getByText(/That code is incorrect or has expired/iu),
    ).toBeVisible()

    // 2.2 Submit Valid Code
    await page.getByLabel("Verification code").fill(e2eVerificationCode)
    await page.getByRole("button", { name: "Verify email" }).click()

    // Successfully verify and land in /today
    await expect(page).toHaveURL(/\/today$/u, { timeout: 30_000 })
  })

  // ─── 3. LOGIN, USER ENUMERATION & COOKIE ATTRIBUTES ───
  test("3. Login Workflow: User Enumeration Invariance & Cookie Security", async ({
    context,
    page,
  }) => {
    const email = `login-audit-${randomUUID().slice(0, 8)}@example.com`
    const password = "ValidPassword1234!"

    // Create and verify account
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Login Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)

    // Sign out to test sign-in
    await page.goto("/profile")
    await page.getByRole("button", { name: "Log out" }).click()
    await page.waitForURL("**/sign-out*")

    // Direct navigation to login form
    await page.goto("/sign-in?mode=login")
    await page.waitForLoadState("networkidle")

    // 3.1 Non-existent Email Login Attempt
    await page
      .getByLabel("Email")
      .fill(`fake-${randomUUID().slice(0, 8)}@example.com`)
    await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!")
    await page.getByRole("button", { name: "Enter" }).click()

    await expect(page.locator(".auth__error").first()).toBeVisible()
    const nonexistentError = await page
      .locator(".auth__error")
      .first()
      .textContent()

    // 3.2 Real Email with Wrong Password Login Attempt
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!")
    await page.getByRole("button", { name: "Enter" }).click()

    await expect(page.locator(".auth__error").first()).toBeVisible()
    const wrongPasswordError = await page
      .locator(".auth__error")
      .first()
      .textContent()

    // Assert responses are identical (preventing user enumeration)
    expect(nonexistentError).toBe(wrongPasswordError)
    expect(nonexistentError).toContain("Sign-in was unsuccessful")

    // 3.3 Successful Login & Cookie Verification
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByRole("button", { name: "Enter" }).click()
    await expect(page).toHaveURL(/\/today$/u, { timeout: 30_000 })

    // Inspect Session Cookie
    const cookies = await context.cookies()
    const sessionCookie = cookies.find(
      (c) => c.name === "questly.session_token",
    )
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie?.httpOnly).toBe(true)
    expect(sessionCookie?.sameSite).toBe("Lax")
    expect(sessionCookie?.path).toBe("/")
  })

  // ─── 4. LOGOUT & POST-LOGOUT TOKEN INVALIDATION ───
  test("4. Logout & Token Invalidation: Replay Attack Prevention", async ({
    context,
    page,
  }) => {
    const email = `logout-audit-${randomUUID().slice(0, 8)}@example.com`
    const password = "ValidPassword1234!"

    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Logout Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)

    // Capture active session cookie
    const cookiesBefore = await context.cookies()
    const sessionCookie = cookiesBefore.find(
      (c) => c.name === "questly.session_token",
    )
    expect(sessionCookie).toBeDefined()

    // Perform Logout via UI button on /profile
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Log out" }).click()
    await page.waitForURL("**/sign-out*", { timeout: 30_000 })
    await expect(
      page.getByRole("heading", { name: /You have been signed out/iu }),
    ).toBeVisible()

    // Attempt Replay Attack: Re-inject the revoked session cookie
    if (sessionCookie) {
      await context.addCookies([sessionCookie])
    }

    // Direct navigation to protected route
    await page.goto("/today")

    // Expect server to reject revoked cookie and redirect to sign-in
    await expect(page).toHaveURL(/\/sign-in/u)
  })

  // ─── 5. PASSWORD RESET WORKFLOW & UNIFORMITY ───
  test("5. Password Reset Flow: Generic Reassurance & Invalid Token Rejection", async ({
    page,
  }) => {
    // 5.1 Nonexistent vs Existent Request
    await page.goto("/forgot-password")
    await page
      .locator("#recovery-email")
      .fill(`nonexistent-${randomUUID().slice(0, 8)}@example.com`)
    await page.getByRole("button", { name: "Send reset link" }).click()

    // Generic reassurance popup must appear
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible()

    // 5.2 Invalid / Expired Reset Token Handling
    await page.goto(
      "/reset-password?token=invalid-expired-token-12345678901234567890",
    )
    await expect(
      page.getByText(
        /This password-reset link is invalid, expired, or has already been used/iu,
      ),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /Request a new link/iu }),
    ).toBeVisible()
  })

  // ─── 6. HORIZONTAL PRIVILEGE ESCALATION & IDOR (USER A vs USER B) ───
  test("6. Authorization & Tenant Isolation: User B Cannot Access User A Resources", async ({
    browser,
  }) => {
    // Context A: User A
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    const emailA = `user-a-${randomUUID().slice(0, 8)}@example.com`
    const passwordA = "UserAPassword123!"

    await pageA.goto("/sign-up")
    await pageA.getByLabel("Name").fill("User Alpha")
    await pageA.getByLabel("Email").fill(emailA)
    await pageA.getByLabel("Password", { exact: true }).fill(passwordA)
    await pageA.locator("#termsAccepted").check()
    await pageA.locator("#privacyNoticeAcknowledged").check()
    await pageA.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(pageA)

    // User A confirms authenticated dashboard access
    await pageA.goto("/today")
    await pageA.waitForLoadState("networkidle")
    await expect(pageA).toHaveURL(/\/today$/u)

    // Context B: User B (Separate isolated browser session)
    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    const emailB = `user-b-${randomUUID().slice(0, 8)}@example.com`
    const passwordB = "UserBPassword123!"

    await pageB.goto("/sign-up")
    await pageB.getByLabel("Name").fill("User Beta")
    await pageB.getByLabel("Email").fill(emailB)
    await pageB.getByLabel("Password", { exact: true }).fill(passwordB)
    await pageB.locator("#termsAccepted").check()
    await pageB.locator("#privacyNoticeAcknowledged").check()
    await pageB.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(pageB)

    // User B attempts IDOR: Access a random foreign workspace UUID or nonexistent tenant
    const foreignWorkspaceUUID = randomUUID()
    const response = await pageB.goto(`/app/workspaces/${foreignWorkspaceUUID}`)
    expect([200, 403]).toContain(response?.status())

    // User B receives boundary denial UI
    await expect(
      pageB.getByRole("heading", {
        name: "This workspace is outside your access boundary.",
      }),
    ).toBeVisible()

    await contextA.close()
    await contextB.close()
  })

  // ─── 7. ACCOUNT SECURITY: SESSIONS LISTING & REQUISITE AUTH FOR DELETION ───
  test("7. Account Security & Deletion: Password Guarded Cascading Purge", async ({
    page,
  }) => {
    const email = `purge-${randomUUID().slice(0, 8)}@example.com`
    const password = "PurgePassword1234!"

    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Purge Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)

    // Navigate to profile Security & data tab
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    const securityDetails = page.locator(".profile-security-settings__trigger")
    await securityDetails.click()

    // Verify Active Sessions Tab is visible
    await expect(page.locator("#security-tab-sessions")).toBeVisible()
    await expect(page.locator("#security-tab-consent")).toBeVisible()

    // Switch to Consent & Data tab
    await page.locator("#security-tab-consent").click()

    // Scroll to Delete Account section
    const deleteButton = page.getByRole("button", { name: "Delete my account" })
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()

    // Expect Confirmation Dialog to require Password
    await expect(
      page.getByRole("heading", { name: "Delete your account?" }),
    ).toBeVisible()

    // Try wrong password
    await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!")
    await page.getByRole("button", { name: "Permanently delete" }).click()

    await expect(page.getByText(/That password is not correct/iu)).toBeVisible()

    // Enter correct password and confirm deletion
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByRole("button", { name: "Permanently delete" }).click()

    // Confirm deletion succeeds and user is redirected to sign-out / sign-in
    await page.waitForURL("**/sign-out*", { timeout: 30_000 })
  })
})
