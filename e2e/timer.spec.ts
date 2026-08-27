import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

test.use({ locale: "en-IN", timezoneId: "Asia/Kolkata" })

function clockSeconds(value: string | null) {
  const clock = value?.match(/\d{2}:\d{2}:\d{2}/u)?.[0] ?? "00:00:00"
  const [hours = 0, minutes = 0, seconds = 0] = clock.split(":").map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

test("room code entry keeps an iOS-safe font size without viewport zoom", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto("/~offline")

  const fontSize = await page.evaluate(() => {
    const form = document.createElement("form")
    form.className = "group-study__form"

    const input = document.createElement("input")
    input.className = "group-study__code-input"
    form.append(input)
    document.body.append(form)

    const computedFontSize = Number.parseFloat(
      window.getComputedStyle(input).fontSize,
    )
    form.remove()
    return computedFontSize
  })

  expect(fontSize).toBeGreaterThanOrEqual(16)
})

test("runs, pauses, resumes, edits, isolates history, and stops on close", async ({
  context,
  page,
}) => {
  const email = `timer-${randomUUID()}@example.com`
  const password = "correct-horse-battery-staple"
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Timer Operator")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)

  const primaryLinks = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link")
  await expect(primaryLinks).toHaveText([
    "Home",
    "Tasks",
    "Timer",
    "Progress",
    "Profile",
  ])
  await page.getByRole("link", { name: "Timer" }).click()
  await expect(page).toHaveURL(/\/timer$/u)
  await expect(
    page.getByRole("heading", { name: "Timer", exact: true }),
  ).toBeVisible()
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0)

  await page.getByLabel("Session subject").fill("Deep work")
  await page.getByRole("button", { name: "Start timer" }).click()
  await expect(
    page.getByRole("dialog", { name: "Timer started!" }),
  ).toBeVisible()
  await expect(page.getByText("Focus session started")).toHaveCount(0)
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(
    page.getByText("Deep work", { exact: true }).first(),
  ).toBeVisible()

  const timer = page.getByRole("timer")
  const beforeBackground = clockSeconds(await timer.textContent())
  const backgroundPage = await context.newPage()
  await backgroundPage.goto("/profile")
  await backgroundPage.bringToFront()
  await backgroundPage.waitForTimeout(1_500)
  await page.bringToFront()
  await expect
    .poll(async () => clockSeconds(await timer.textContent()))
    .toBeGreaterThan(beforeBackground)

  await page.getByRole("button", { name: "Pause" }).click()
  await expect(
    page.getByRole("dialog", { name: "Timer paused!" }),
  ).toBeVisible()
  await expect(page.getByText("Timer paused", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible()
  const pausedAt = clockSeconds(await timer.textContent())
  await page.waitForTimeout(1_250)
  expect(clockSeconds(await timer.textContent())).toBe(pausedAt)

  await page.getByRole("button", { name: "Resume" }).click()
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()
  await expect
    .poll(async () => clockSeconds(await timer.textContent()))
    .toBeGreaterThan(pausedAt)

  await page.getByRole("button", { name: "Edit subject Deep work" }).click()
  await page.getByLabel("Edit session subject").fill("Algorithms")
  await page.getByRole("button", { name: "Save subject" }).click()
  await expect(
    page.getByText("Algorithms", { exact: true }).first(),
  ).toBeVisible()

  await page.getByRole("button", { name: "Finish" }).click()
  await expect(
    page.getByRole("dialog", { name: "Session complete!" }),
  ).toBeVisible()
  await expect(page.getByText("Session saved to Timer history")).toHaveCount(0)
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByRole("button", { name: "Start timer" })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Timer history" }),
  ).toBeVisible()
  await expect(page.getByText("Algorithms", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Edit subject Algorithms" }),
  ).toHaveCount(0)

  await page.getByRole("link", { name: "Progress" }).click()
  await expect(
    page.getByRole("heading", { name: "Progress history" }),
  ).toBeVisible()
  await expect(page.getByText("Algorithms", { exact: true })).toHaveCount(0)

  await page.getByRole("link", { name: "Timer" }).click()
  await page.getByLabel("Session subject").fill("Close boundary")
  await page.getByRole("button", { name: "Start timer" }).click()
  await expect(
    page.getByRole("dialog", { name: "Timer started!" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(
    page.getByText("Close boundary", { exact: true }).first(),
  ).toBeVisible()

  await backgroundPage.bringToFront()
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  )
  await page.close({ runBeforeUnload: true })
  await backgroundPage.waitForTimeout(750)
  await backgroundPage.goto("/timer")
  await expect(
    backgroundPage.getByRole("button", { name: "Start timer" }),
  ).toBeVisible()
  await expect(
    backgroundPage.getByText("Close boundary", { exact: true }),
  ).toBeVisible()
  expect(consoleErrors).toEqual([])
})
