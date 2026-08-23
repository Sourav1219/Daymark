import { randomUUID } from "node:crypto"

import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("creates, edits, clears, reopens, deletes, and restores a Quest", async ({
  page,
}) => {
  const originalTitle = "Map the silent corridor"
  const editedTitle = "Map the spectral corridor"

  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Quest Operator")
  await page.getByLabel("Email").fill(`quest-${randomUUID()}@example.com`)
  await page.getByLabel("Password").fill("correct-horse-battery-staple")
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)

  await page.getByRole("button", { name: "View 0 day streak" }).click()
  const manualStreak = page.getByRole("dialog", { name: "Start the flame" })
  await expect(manualStreak).toBeVisible()
  expect(
    await manualStreak
      .locator("..")
      .evaluate((stage) => stage.parentElement?.id),
  ).toBe("app-device-viewport")
  await manualStreak.getByRole("button", { name: "Keep going" }).click()
  await expect(manualStreak).toBeHidden()

  await page.goto("/quests")
  const createForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })

  await createForm.getByLabel("Task title").fill(originalTitle)
  await createForm
    .getByLabel("Description")
    .fill("Record the safe route before the signal fades.")
  await createForm.getByLabel("High").check()
  await createForm.getByRole("button", { name: "Tomorrow · 9–5" }).click()
  await createForm.getByLabel("Start time · IST").click()
  const startTime = page.getByLabel("Start time · IST exact value")
  await startTime.fill("")
  await startTime.fill("09:03")
  expect(
    await startTime.evaluate((input: HTMLInputElement) =>
      input.checkValidity(),
    ),
  ).toBe(true)
  await startTime
    .locator("..")
    .getByRole("button", { name: "Use time" })
    .click()
  await expect(createForm.getByLabel("Start time · IST")).toContainText("09:03")
  await createForm.getByLabel("Due time · IST").click()
  const dueTime = page.getByLabel("Due time · IST exact value")
  await dueTime.fill("")
  await dueTime.fill("18:07")
  expect(
    await dueTime.evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(true)
  await dueTime.locator("..").getByRole("button", { name: "Use time" }).click()
  await expect(createForm.getByLabel("Due time · IST")).toContainText("18:07")
  await createForm.getByRole("button", { name: "Create Task" }).click()
  await expect(
    page.getByRole("dialog", { name: "Task created!" }),
  ).toBeVisible()
  await page.getByRole("link", { name: "Continue" }).click()

  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("searchbox", { name: "Search" }).fill(originalTitle)

  let quest = page.getByRole("article", { name: originalTitle })
  await expect(quest).toBeVisible()
  await expect(quest.getByText("high priority")).toBeVisible()
  await quest.getByText("Manage", { exact: true }).click()
  await quest.getByText("Edit Task", { exact: true }).click()
  const editPanel = quest.locator("form").filter({ hasText: "Save changes" })
  await editPanel.getByLabel("Task title").fill(editedTitle)
  await editPanel.getByLabel("Priority").selectOption("critical")
  await editPanel.getByRole("button", { name: "Save changes" }).click()
  await expect(quest).toBeHidden()

  await page.getByRole("searchbox", { name: "Search" }).fill(editedTitle)
  await expect(page).toHaveURL(/search=Map(?:\+|%20)the(?:\+|%20)spectral/u)
  quest = page.getByRole("article", { name: editedTitle })
  await expect(quest).toBeVisible()
  await expect(quest.getByText("critical priority")).toBeVisible()

  await quest.getByRole("button", { name: `Complete ${editedTitle}` }).click()
  const earnedStreak = page.getByRole("dialog", { name: "1 day strong" })
  await expect(earnedStreak).toBeVisible()
  await expect(earnedStreak.getByText("Streak ignited")).toBeVisible()
  await expect(earnedStreak.getByText("+50 XP")).toBeVisible()
  await earnedStreak.getByRole("button", { name: "Keep going" }).click()
  await expect(quest).toBeHidden()

  await page.goto("/today")
  await expect(
    page.getByRole("heading", { name: "Completed" }),
  ).not.toBeVisible()
  await expect(
    page.getByText("No active tasks for this date.").first(),
  ).toBeVisible()
  await expect(page.getByLabel("Points for selected date")).not.toBeVisible()
  await page.getByRole("link", { name: "Previous day" }).first().click()
  await expect(page).toHaveURL(/\/today\?date=\d{4}-\d{2}-\d{2}$/u)
  const previousDate = new URL(page.url()).searchParams.get("date")
  expect(previousDate).not.toBeNull()
  await expect(
    page.getByText("No recorded activity on this date."),
  ).toBeVisible()
  await page.getByRole("link", { name: "Profile" }).first().click()
  await expect(page).toHaveURL(`/profile?date=${previousDate}`)
  await page.getByRole("link", { name: "Tasks" }).first().click()
  await expect(page).toHaveURL(`/quests?date=${previousDate}`)
  await page.getByRole("link", { name: "Progress" }).first().click()
  await expect(page).toHaveURL(`/progress?date=${previousDate}`)
  let history = page.getByRole("region", { name: "Progress history" })
  await expect(history.getByText("No points activity yet")).toBeVisible()
  await expect(history.getByText(editedTitle)).not.toBeVisible()

  await page.goto("/today")
  await page.getByRole("link", { name: "Progress" }).first().click()
  await expect(page).toHaveURL(/\/progress$/u)
  history = page.getByRole("region", { name: "Progress history" })
  await expect(
    page.getByRole("progressbar", { name: "Today: 50 of 50 points" }),
  ).toBeVisible()
  await expect(
    page.getByRole("progressbar", { name: "This week: 50 of 50 points" }),
  ).toBeVisible()
  await expect(history.getByText(editedTitle)).toBeVisible()
  await expect(
    history.locator(".progress-timeline__xp").getByText("+50 points", {
      exact: true,
    }),
  ).toBeVisible()
  await history.getByRole("link", { name: editedTitle }).click()
  await expect(page).toHaveURL(
    /\/today\?date=\d{4}-\d{2}-\d{2}&task=[0-9a-f-]{36}$/u,
  )
  const focusedHistoryTask = page.getByRole("article", { name: editedTitle })
  await expect(focusedHistoryTask).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Completed" })).toHaveCount(0)

  await page.goto("/cleared")
  quest = page.getByRole("article", { name: editedTitle })
  await expect(quest).toBeVisible()
  await expect(
    quest.locator('[data-slot="badge"]').filter({ hasText: /^Cleared$/u }),
  ).toBeVisible()
  await quest.getByRole("button", { name: "Reopen Task" }).click()
  await expect(quest).toBeHidden()

  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("searchbox", { name: "Search" }).fill(editedTitle)
  quest = page.getByRole("article", { name: editedTitle })
  await expect(quest).toBeVisible()
  await quest.getByText("Manage", { exact: true }).click()
  await quest.getByRole("button", { name: "Delete Task" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Move to Trash" }).click()

  await page.getByRole("tab", { name: /Trash/u }).click()
  const trashed = page.getByRole("article", { name: editedTitle })
  await expect(trashed).toBeVisible()
  await trashed.getByRole("button", { name: "Restore Task" }).click()
  const restoreTimeline = page.getByRole("alertdialog", {
    name: "Set a new timeline",
  })
  await expect(restoreTimeline).toBeVisible()
  await expect(restoreTimeline.getByLabel("Start date · IST")).toBeVisible()
  await expect(restoreTimeline.getByLabel("Start time · IST")).toBeVisible()
  await expect(restoreTimeline.getByLabel("Due date · IST")).toBeVisible()
  await expect(restoreTimeline.getByLabel("Due time · IST")).toBeVisible()
  await restoreTimeline.getByLabel("Start date · IST").click()
  await expect(page.getByText("Select a date", { exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await restoreTimeline.getByLabel("Start time · IST").click()
  await expect(page.getByLabel("Start time · IST exact value")).toBeVisible()
  await page.keyboard.press("Escape")
  await restoreTimeline
    .getByRole("button", { name: "Restore with new time" })
    .click()
  await expect(trashed).toBeHidden()
  const restoredDialog = page.getByRole("dialog", { name: "Task restored!" })
  await expect(restoredDialog).toBeVisible()
  await expect(restoredDialog.getByText(editedTitle)).toBeVisible()
  await restoredDialog.getByRole("button", { name: "Continue" }).click()

  await page.getByRole("tab", { name: /Search/u }).click()
  await expect(page.getByRole("article", { name: editedTitle })).toBeVisible()

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})
