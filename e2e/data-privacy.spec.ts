import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test.describe.configure({ mode: "serial" })

test.describe("Phase 7 — Database, Data Isolation & Privacy Audit", () => {
  test.setTimeout(120_000)

  // ─── 1. CROSS-TENANT DATA ISOLATION (USER A vs USER B) ───
  test("1. Cross-Tenant Isolation: User B Cannot Access User A's Quests", async ({
    browser,
  }) => {
    // 1.1 Register User A in Context A
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()

    const emailA = `tenant-a-${randomUUID().slice(0, 8)}@example.com`
    const passwordA = "ValidPassword1234!"

    await pageA.goto("/sign-up")
    await pageA.getByLabel("Name").fill("Tenant User A")
    await pageA.getByLabel("Email").fill(emailA)
    await pageA.getByLabel("Password", { exact: true }).fill(passwordA)
    await pageA.locator("#termsAccepted").check()
    await pageA.locator("#privacyNoticeAcknowledged").check()
    await pageA.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(pageA)
    await expect(pageA).toHaveURL(/\/today$/u)

    // User A creates a confidential task
    await pageA.goto("/quests")
    await pageA.waitForLoadState("networkidle")
    const confidentialTitle = `Confidential Strategy Task ${randomUUID().slice(0, 6)}`
    const createFormA = pageA.locator("form", {
      has: pageA.getByRole("button", { name: "Create Task" }),
    })
    await createFormA.getByLabel("Task title").fill(confidentialTitle)
    await createFormA.getByRole("button", { name: "Create Task" }).click()
    await pageA
      .getByRole("dialog", { name: "Task created!" })
      .getByRole("link", { name: "Continue" })
      .click()
    await pageA.waitForURL("**/today*")

    // 1.2 Register User B in Context B (Separate Tenant)
    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()

    const emailB = `tenant-b-${randomUUID().slice(0, 8)}@example.com`
    const passwordB = "ValidPassword1234!"

    await pageB.goto("/sign-up")
    await pageB.getByLabel("Name").fill("Tenant User B")
    await pageB.getByLabel("Email").fill(emailB)
    await pageB.getByLabel("Password", { exact: true }).fill(passwordB)
    await pageB.locator("#termsAccepted").check()
    await pageB.locator("#privacyNoticeAcknowledged").check()
    await pageB.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(pageB)
    await expect(pageB).toHaveURL(/\/today$/u)

    // User B navigates to /quests and searches for User A's task
    await pageB.goto("/quests")
    await pageB.waitForLoadState("networkidle")

    // User A's task MUST NOT be visible in User B's workspace
    await expect(pageB.getByText(confidentialTitle)).toHaveCount(0)

    await contextA.close()
    await contextB.close()
  })

  // ─── 2. SOFT-DELETE ISOLATION (TRASH LIFECYCLE) ───
  test("2. Soft-Delete Isolation: Trashed Tasks Excluded from Active Views", async ({
    page,
  }) => {
    const email = `soft-del-${randomUUID().slice(0, 8)}@example.com`
    const password = "ValidPassword1234!"

    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Delete Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)

    // Create a task
    await page.goto("/quests")
    await page.waitForLoadState("networkidle")
    const taskTitle = `Ephemeral Task ${randomUUID().slice(0, 6)}`
    const createForm = page.locator("form", {
      has: page.getByRole("button", { name: "Create Task" }),
    })
    await createForm.getByLabel("Task title").fill(taskTitle)
    await createForm.getByRole("button", { name: "Create Task" }).click()
    await page
      .getByRole("dialog", { name: "Task created!" })
      .getByRole("link", { name: "Continue" })
      .click()
    await page.waitForURL("**/today*")

    // Go to /quests and locate active task
    await page.goto("/quests")
    await page.waitForLoadState("networkidle")

    const questCard = page.getByRole("article", { name: taskTitle })
    await expect(questCard).toBeVisible({ timeout: 15_000 })
    await questCard.getByRole("button", { name: "Delete Task" }).click()

    // Confirm Move to Trash dialog
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "Move to Trash" }).click()
    await expect(dialog).toBeHidden()

    // Task must immediately vanish from active view
    await expect(questCard).toBeHidden()

    // Task must also be absent on /today
    await page.goto("/today")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(taskTitle)).toHaveCount(0)

    // Task is ONLY visible under the dedicated Trash tab on /quests
    await page.goto("/quests")
    await page.waitForLoadState("networkidle")
    await page.locator("#quest-trash-tab").click()
    const trashedCard = page.getByRole("article", { name: taskTitle })
    await expect(trashedCard).toBeVisible({ timeout: 15_000 })
  })
})
