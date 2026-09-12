import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test("queues encrypted offline edits and a dependent deletion", async ({
  page,
}) => {
  test.setTimeout(120_000)

  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Offline Editor")
  await page.getByLabel("Email").fill(`offline-${randomUUID()}@example.com`)
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery-staple")
  await page.locator("#termsAccepted").check()
  await page.locator("#privacyNoticeAcknowledged").check()
  await page.getByRole("button", { name: "Create" }).click()
  await completeEmailVerification(page)
  await expect(page).toHaveURL(/\/today$/u)
  await page.goto("/quests")

  const createForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await createForm.getByLabel("Task title").fill("Offline draft")
  await createForm.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()

  // Enable and unlock only after the online fixture exists. From this point
  // onward navigation stays client-side so the non-extractable session key is
  // retained while the offline mutations are queued and replayed.
  await page.goto("/settings")
  await page.getByLabel("Create offline passcode").fill("offline-test-passcode")
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.getByRole("button", { name: "Enable encrypted offline data" }).click(),
  ])
  await page.goto("/quests")
  await expect(page).toHaveURL(/\/quests$/u)
  await page.getByLabel("Offline data passcode").fill("offline-test-passcode")
  await page.getByRole("button", { name: "Unlock offline data" }).click()
  await expect(page.getByText("Offline data unlocked")).toBeVisible()
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("button", { name: "Arrange all tasks" }).click()
  const quest = page.getByRole("article", { name: "Offline draft" })
  await expect(quest).toBeVisible()
  await quest.getByText("Edit Task", { exact: true }).click()
  const editForm = quest.locator("form", { hasText: "Save changes" })
  await editForm.getByLabel("Task title").fill("Offline draft updated")

  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    })
    window.dispatchEvent(new Event("offline"))
  })
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)
  await expect(
    page.getByText(/Offline — recent tasks remain available/u),
  ).toBeVisible()
  await editForm.getByRole("button", { name: "Save changes" }).click()
  await expect(
    page.getByText("Task edit queued for reconnection"),
  ).toBeVisible()
  await quest.getByRole("button", { name: "Delete Task" }).click()
  const confirmation = page.getByRole("alertdialog", {
    name: "Move this task to Trash?",
  })
  await confirmation.getByRole("button", { name: "Move to Trash" }).click()
  await expect(
    page.getByText("Task deletion queued for reconnection"),
  ).toBeVisible()
  await expect(page.getByText(/2 changes queued/u)).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Review offline conflicts" }),
  ).toHaveCount(0)
})
