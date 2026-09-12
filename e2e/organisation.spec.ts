import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test("organises and finds Quests with Phase 5 controls", async ({ page }) => {
  test.setTimeout(120_000)
  const suffix = randomUUID().slice(0, 8)
  const gateName = `Moon Gate ${suffix}`
  const parentTitle = `Chart the moon path ${suffix}`
  const childTitle = `Mark the first waypoint ${suffix}`

  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Phase Five Operator")
  await page.getByLabel("Email").fill(`phase-five-${randomUUID()}@example.com`)
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery-staple")
  await page.locator("#termsAccepted").check()
  await page.locator("#privacyNoticeAcknowledged").check()
  await page.getByRole("button", { name: "Create" }).click()
  await completeEmailVerification(page)
  await expect(page).toHaveURL(/\/today$/u)

  await page.goto("/gates")
  const gateForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create List" }),
  })
  await gateForm.getByLabel("List name").fill(gateName)
  await gateForm.getByLabel("Description").fill("A Phase 5 list.")
  await gateForm.getByRole("button", { name: "Create List" }).click()
  await expect(page.getByRole("article", { name: gateName })).toBeVisible()

  await page.goto("/quests")
  const createForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await createForm.getByLabel("Task title").fill(parentTitle)
  await createForm.getByLabel("Description").fill("Searchable moon route.")
  await createForm.getByLabel("Critical").check()
  await createForm.getByText("More options", { exact: true }).click()
  await createForm.getByLabel("List").selectOption({ label: gateName })
  await createForm.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()
  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("searchbox", { name: "Search" }).fill(parentTitle)

  const parentQuest = page.getByRole("article", { name: parentTitle })
  await expect(
    parentQuest.locator('[data-slot="badge"]').filter({ hasText: gateName }),
  ).toBeVisible()

  await parentQuest.getByRole("button", { name: "Manage" }).click()
  await parentQuest.getByText("Add Subtask", { exact: true }).click()
  const subquestForm = parentQuest.locator("form", {
    has: page.getByRole("button", { name: "Create Subtask" }),
  })
  await subquestForm.getByLabel("Task title").fill(childTitle)
  await subquestForm.getByRole("button", { name: "Create Subtask" }).click()
  await page.getByRole("searchbox", { name: "Search" }).fill(childTitle)
  await expect(page.getByRole("article", { name: childTitle })).toBeVisible()
  await expect(
    page
      .getByRole("article", { name: childTitle })
      .getByText("Subtask", { exact: true }),
  ).toBeVisible()

  await page.getByRole("searchbox", { name: "Search" }).fill(parentTitle)
  await expect(page).toHaveURL(/search=Chart(?:\+|%20)the(?:\+|%20)moon/u)
  await expect(page.getByRole("article", { name: parentTitle })).toBeVisible()
  await expect(page.getByRole("article", { name: childTitle })).toBeHidden()

  await page.getByRole("button", { name: "Reset filters" }).click()
  await expect(page).toHaveURL(/\/quests$/u)
  await page.getByRole("button", { name: "Arrange all tasks" }).click()
  await expect(page.getByRole("article", { name: parentTitle })).toBeVisible()

  await page.goto("/today")
  const todayTask = page.getByRole("article").filter({ hasText: parentTitle })
  await expect(todayTask).toBeVisible()
  await todayTask.getByRole("button", { name: `Clear ${parentTitle}` }).click()
  await expect(
    page.getByRole("dialog").filter({ hasText: parentTitle }),
  ).toBeVisible()
  await page.goto("/cleared")
  await page.getByRole("searchbox", { name: "Search" }).fill(parentTitle)
  await expect(page).toHaveURL(/\/cleared\?search=/u)
  await expect(page.getByRole("article", { name: parentTitle })).toBeVisible()

  await page.goto("/gates")
  const gate = page.getByRole("article", { name: gateName })
  await expect(
    gate.getByText(/Move its 1 task to another List or No List/u),
  ).toBeVisible()
  await gate.getByRole("link", { name: "View Tasks" }).click()
  await expect(page).toHaveURL(/\/quests\?gateId=/u)
})
