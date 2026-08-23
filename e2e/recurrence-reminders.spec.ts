import { randomUUID } from "node:crypto"

import { expect, test, type Page } from "@playwright/test"

async function register(page: Page) {
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Recurrence Operator")
  await page.getByLabel("Email").fill(`recurrence-${randomUUID()}@example.com`)
  await page.getByLabel("Password").fill("correct-horse-battery-staple")
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)
}

function futureLocalInput(days: number, hour: number) {
  const value = new Date(Date.now() + days * 24 * 60 * 60_000)
  value.setHours(hour, 0, 0, 0)
  const pad = (part: number) => String(part).padStart(2, "0")

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:00`
}

test("previews recurrence, creates the next Quest, and manages a reminder", async ({
  page,
}) => {
  const title = `Recurring Quest ${randomUUID().slice(0, 8)}`
  await register(page)
  await page.goto("/quests")

  const createForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await createForm.getByLabel("Task title").fill(title)
  await createForm.getByRole("button", { name: "Tomorrow · 9–5" }).click()
  await createForm.getByText("More options", { exact: true }).click()
  await createForm.getByLabel("Repeat").selectOption("RRULE:FREQ=DAILY")
  await expect(createForm.getByText(/Next quest:/u)).toBeVisible()
  await createForm.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()
  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("searchbox", { name: "Search" }).fill(title)

  let quest = page.getByRole("article", { name: title })
  await expect(quest.getByText("Recurring", { exact: true })).toBeVisible()
  await quest.getByRole("button", { name: `Complete ${title}` }).click()
  await expect(page.getByText("Momentum gained", { exact: true })).toBeVisible()
  quest = page.getByRole("article", { name: title })
  await expect(quest).toBeVisible()
  await expect(quest.getByText("Recurring", { exact: true })).toBeVisible()

  await page.goto("/settings")
  await page.getByLabel("Task").selectOption({ label: title })
  await page.getByLabel("Remind at · IST").fill(futureLocalInput(1, 8))
  await page.getByLabel("Channel").selectOption("in_app")
  await page.getByRole("button", { name: "Create reminder" }).click()
  await expect(
    page.getByText("Reminder scheduled", { exact: true }),
  ).toBeVisible()
  const schedule = page.getByRole("listitem").filter({ hasText: title })
  await expect(schedule.getByText("pending", { exact: true })).toBeVisible()
  await expect(schedule.getByRole("link", { name: title })).toHaveAttribute(
    "href",
    /\/quests\/[0-9a-f-]{36}$/u,
  )
  await schedule.getByText("Edit reminder", { exact: true }).click()
  await schedule.getByRole("button", { name: "Cancel reminder" }).click()
  await expect(
    page.getByText("Reminder cancelled", { exact: true }),
  ).toBeVisible()
  await expect(schedule.getByText("cancelled", { exact: true })).toBeVisible()
})
