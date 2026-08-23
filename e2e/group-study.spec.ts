import { randomUUID } from "node:crypto"

import { expect, test, type BrowserContext, type Page } from "@playwright/test"

test.use({ locale: "en-IN", timezoneId: "Asia/Kolkata" })

function clockSeconds(value: string | null) {
  const clock = value?.match(/\d{2}:\d{2}:\d{2}/u)?.[0] ?? "00:00:00"
  const [hours = 0, minutes = 0, seconds = 0] = clock.split(":").map(Number)
  return hours * 3_600 + minutes * 60 + seconds
}

async function register(page: Page, name: string) {
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill(name)
  await page.getByLabel("Email").fill(`group-${randomUUID()}@example.com`)
  await page.getByLabel("Password").fill("correct-horse-battery-staple")
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)
  await page.goto("/timer")
}

function participant(page: Page, name: string) {
  return page.locator(".group-study-person").filter({ hasText: name })
}

test("keeps every Group Study participant independent", async ({ browser }) => {
  const contexts: BrowserContext[] = []
  const consoleErrors: string[] = []

  async function member(name: string) {
    const context = await browser.newContext({
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
    })
    contexts.push(context)
    const page = await context.newPage()
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    })
    await register(page, name)
    return page
  }

  try {
    const first = await member("First Study Member")
    const second = await member("Second Study Member")

    await first.getByLabel("Room name").fill("Systems room")
    await first.getByLabel("Study objective").fill("Operating systems")
    await first.getByRole("button", { name: "Create & start" }).click()
    await expect(
      first.getByRole("dialog", { name: "Timer started!" }),
    ).toBeVisible()
    await first.getByRole("button", { name: "Continue" }).click()
    const joinCode = await first
      .locator(".group-study-room__code strong")
      .textContent()
    expect(joinCode).toMatch(/^[23456789A-HJ-NP-Z]{8}$/u)

    await second.getByLabel("Room code").fill(joinCode ?? "")
    await second.getByRole("button", { name: "Join room" }).click()
    await expect(
      second.getByRole("dialog", { name: "Timer started!" }),
    ).toBeVisible()
    await second.getByRole("button", { name: "Continue" }).click()

    await expect(participant(first, "Second Study Member")).toBeVisible({
      timeout: 7_000,
    })
    await expect(participant(second, "First Study Member")).toBeVisible()
    await expect(
      second.getByText("2 / 8 active", { exact: true }),
    ).toBeVisible()
    await expect(
      first.getByText("Host controls", { exact: true }),
    ).toBeVisible()
    await expect(
      second.getByText("Host controls", { exact: true }),
    ).toHaveCount(0)

    await first.getByLabel("Room name").fill("Deep work room")
    await first.getByLabel("Objective").fill("Operating systems review")
    await first.getByLabel("Limit").fill("5")
    await first.getByRole("button", { name: "Save" }).click()
    await expect(
      first.getByRole("heading", { name: "Deep work room" }),
    ).toBeVisible()
    await first.getByRole("button", { name: "Lock room" }).click()
    await expect(
      first.getByRole("button", { name: "Unlock room" }),
    ).toBeVisible()
    await first.getByRole("button", { name: "Unlock room" }).click()
    await first.getByRole("button", { name: "New join code" }).click()
    await expect
      .poll(() => first.locator(".group-study-room__code strong").textContent())
      .not.toBe(joinCode)

    const secondTimer = second.getByRole("timer")
    const secondBeforePause = clockSeconds(await secondTimer.textContent())
    await first.getByRole("button", { name: "Pause" }).click()
    await expect(
      first.getByRole("dialog", { name: "Timer paused!" }),
    ).toBeVisible()
    await first.getByRole("button", { name: "Continue" }).click()

    await expect(participant(second, "First Study Member")).toContainText(
      "Paused",
      { timeout: 7_000 },
    )
    await expect(
      second.getByText(/First Study Member paused their timer/u),
    ).toBeVisible()
    await expect
      .poll(async () => clockSeconds(await secondTimer.textContent()))
      .toBeGreaterThan(secondBeforePause)

    const firstPausedAt = clockSeconds(
      await first.getByRole("timer").textContent(),
    )
    await first.waitForTimeout(1_200)
    expect(clockSeconds(await first.getByRole("timer").textContent())).toBe(
      firstPausedAt,
    )

    await first.getByRole("button", { name: "Resume" }).click()
    await expect(participant(second, "First Study Member")).toContainText(
      "Focusing",
      { timeout: 7_000 },
    )
    await expect(
      second.getByText(/First Study Member resumed their timer/u),
    ).toBeVisible()

    const secondBeforeLeave = clockSeconds(await secondTimer.textContent())
    await first.getByRole("button", { name: "Stop & leave" }).click()
    await expect(
      first.getByRole("dialog", { name: "Session complete!" }),
    ).toBeVisible()
    await first.getByRole("button", { name: "Continue" }).click()

    await expect(second.getByText("1 / 5 active", { exact: true })).toBeVisible(
      { timeout: 7_000 },
    )
    await expect(participant(second, "First Study Member")).toHaveCount(0)
    await expect(
      second.getByText(/First Study Member stopped and left the room/u),
    ).toBeVisible()
    await expect
      .poll(async () => clockSeconds(await secondTimer.textContent()))
      .toBeGreaterThan(secondBeforeLeave)

    await second.getByRole("button", { name: "Stop & leave" }).click()
    await expect(
      second.getByRole("dialog", { name: "Session complete!" }),
    ).toBeVisible()
    await second.getByRole("button", { name: "Continue" }).click()
    await expect(
      second.getByRole("heading", { name: "Create a room" }),
    ).toBeVisible()
    const pastRoom = second
      .locator(".group-study-history__card")
      .filter({ hasText: "Operating systems" })
    await expect(pastRoom).toBeVisible()
    await pastRoom.locator("summary").click()
    await expect(
      pastRoom.getByText("Final room summary", { exact: true }),
    ).toBeVisible()
    await expect(
      pastRoom.getByText(/First Study Member paused their timer/u),
    ).toBeVisible()

    await first.getByLabel("Room code").fill(joinCode ?? "")
    await first.getByRole("button", { name: "Join room" }).click()
    await expect(
      first.getByText("That Group Study code is not active."),
    ).toBeVisible()

    await first.getByRole("link", { name: "Progress" }).click()
    await expect(
      first.getByText("Operating systems", { exact: true }),
    ).toHaveCount(0)
    expect(consoleErrors).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
