import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

test("queues offline edits and resolves a later transition conflict", async ({
  context,
  page,
}) => {
  test.setTimeout(45_000)

  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Offline Editor")
  await page.getByLabel("Email").fill(`offline-${randomUUID()}@example.com`)
  await page.getByLabel("Password").fill("correct-horse-battery-staple")
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)
  await page.goto("/quests")

  const createForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await createForm.getByLabel("Task title").fill("Offline draft")
  await createForm.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()

  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("searchbox", { name: "Search" }).fill("Offline draft")
  const quest = page.getByRole("article", { name: "Offline draft" })
  await expect(quest).toBeVisible()
  await quest.getByText("Manage", { exact: true }).click()
  await quest.getByText("Edit Task", { exact: true }).click()
  const editForm = quest.locator("form", { hasText: "Save changes" })
  await editForm.getByLabel("Task title").fill("Offline draft updated")

  await context.setOffline(true)
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

  await context.setOffline(false)
  await page.getByRole("button", { name: "Review offline conflicts" }).click()
  const conflict = page.getByRole("dialog", {
    name: "Resolve offline conflicts",
  })
  await expect(conflict).toContainText("Your offline change: delete")
  await conflict
    .getByRole("button", { name: "Apply my change to latest" })
    .click()

  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  await page
    .getByRole("searchbox", { name: "Search" })
    .fill("Offline draft updated")
  await expect(page.getByRole("article")).toHaveCount(0)
})
