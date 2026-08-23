import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

test("shows a newly created flexible task on the current Home day", async ({
  page,
}) => {
  const title = `Home task ${randomUUID().slice(0, 8)}`

  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Home Task E2E")
  await page.getByLabel("Email").fill(`home-task-${randomUUID()}@example.com`)
  await page.getByLabel("Password").fill("correct-horse-battery-staple")
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)

  await page.goto("/today?date=2026-08-13")
  await page.getByRole("link", { name: "Tasks" }).click()
  await page.getByRole("tab", { name: /Create/u }).click()

  const form = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await form.getByLabel("Task title").fill(title)
  await form.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()

  await expect(page).toHaveURL(/\/today\?task=[0-9a-f-]+$/u)
  await expect(page.getByRole("article", { name: title })).toBeVisible()
  await expect(page.getByRole("article", { name: title })).toBeFocused()
})
