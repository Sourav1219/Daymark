import { randomUUID } from "node:crypto"

import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { DateTime } from "luxon"

async function registerShellUser(page: import("@playwright/test").Page) {
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Shell Operator")
  await page.getByLabel("Email").fill(`shell-${randomUUID()}@example.com`)
  await page.getByLabel("Password").fill("correct-horse-battery-staple")
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)
}

test("mobile-frame shell navigation, feedback primitives, and accessibility pass", async ({
  page,
}) => {
  await registerShellUser(page)

  // The Today route leads with the hero; assert its h1 is present.
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Open command menu" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: /^Open notifications/u }),
  ).toHaveCount(1)
  await expect(
    page.getByRole("button", { name: /^Open notifications/u }),
  ).toBeVisible()
  await page.getByRole("button", { name: /^Open notifications/u }).click()
  const reminderDialog = page.getByRole("dialog", { name: "Notifications" })
  await expect(reminderDialog).toBeVisible()
  await expect(reminderDialog.getByText("You're all caught up")).toBeVisible()
  await page.keyboard.press("Escape")

  await page.reload()
  const skipLink = page.getByRole("link", { name: "Skip to main content" })
  await skipLink.focus()
  await expect(skipLink).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.locator("#main-content")).toBeFocused()

  // Primary destinations live in the always-visible bottom tab bar.
  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  })
  const primaryRoutes = [
    ["Tasks", "/quests"],
    ["Progress", "/progress"],
  ] as const

  for (const [label, path] of primaryRoutes) {
    await primaryNav.getByRole("link", { name: label }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`, "u"))
    await expect(
      page.getByRole("heading", { level: 1, name: label }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Open notifications/u }),
    ).toHaveCount(0)
  }

  // Secondary destinations remain directly addressable outside the compact
  // four-item tab bar.
  const secondaryRoutes = [
    ["Lists", "/gates"],
    ["Completed", "/cleared"],
    ["Settings", "/settings"],
  ] as const

  for (const [label, path] of secondaryRoutes) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`${path}$`, "u"))
    await expect(
      page.getByRole("heading", { level: 1, name: label }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Open notifications/u }),
    ).toHaveCount(0)
  }

  await expect(
    page.locator("#main-content").getByText("Reminder inbox", { exact: true }),
  ).toBeVisible()

  const timezone = page.getByLabel("Timezone")
  await timezone.fill("Europe/London")
  await page.getByRole("button", { name: "Save timezone" }).click()
  await expect(
    page.getByText("Timezone updated", { exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Timezone updated", { exact: true })).toBeHidden({
    timeout: 10_000,
  })

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})

test("the mobile shell pins the outer viewport while content remains scrollable", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto("/~offline")

  const scrollContract = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".app-stage")
    const frame = document.querySelector<HTMLElement>(".device-frame")
    const main = document.querySelector<HTMLElement>(".device-main")

    if (!stage || !frame || !main) {
      throw new Error("The mobile app shell is incomplete")
    }

    window.scrollTo(0, 100)
    frame.scrollTop = 100

    return {
      documentScrollTop: document.scrollingElement?.scrollTop ?? window.scrollY,
      frameOverflow: getComputedStyle(frame).overflow,
      frameScrollTop: frame.scrollTop,
      mainOverflowY: getComputedStyle(main).overflowY,
      mainOverscrollY: getComputedStyle(main).overscrollBehaviorY,
      stageBottom: Math.round(stage.getBoundingClientRect().bottom),
      stageTop: Math.round(stage.getBoundingClientRect().top),
      viewportHeight: window.innerHeight,
    }
  })

  expect(scrollContract).toEqual({
    documentScrollTop: 0,
    frameOverflow: "clip",
    frameScrollTop: 0,
    mainOverflowY: "auto",
    mainOverscrollY: "contain",
    stageBottom: 844,
    stageTop: 0,
    viewportHeight: 844,
  })
})

test("the mobile frame and reduced motion stay usable on a small viewport", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await registerShellUser(page)
  await page.goto("/today")

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  })
  await expect(primaryNav).toBeVisible()
  await primaryNav.getByRole("link", { name: "Tasks" }).click()

  await expect(page).toHaveURL(/\/quests$/u)
  await expect(
    page.getByRole("heading", { level: 1, name: "Tasks" }),
  ).toBeVisible()
  await expect(primaryNav).toBeVisible()

  const title = `Reduced motion Quest ${randomUUID().slice(0, 8)}`
  const createForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await createForm.getByLabel("Task title").fill(title)
  await createForm.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()
  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("searchbox", { name: "Search" }).fill(title)
  const quest = page.getByRole("article", { name: title })
  await expect(quest).toBeVisible()
  await quest.getByRole("button", { name: `Complete ${title}` }).click()
  const completionDialog = page.getByRole("dialog").filter({ hasText: title })
  await expect(completionDialog).toBeVisible()
  expect(
    Number.parseFloat(
      await completionDialog.evaluate(
        (element) => getComputedStyle(element).animationDuration,
      ),
    ),
  ).toBeCloseTo(0.00001, 8)

  const animationSettings = await page.locator("body").evaluate(() => {
    const styles = getComputedStyle(document.body)
    return {
      animationIterationCount: styles.animationIterationCount,
      transitionDuration: styles.transitionDuration,
    }
  })
  expect(animationSettings.animationIterationCount).toBe("1")
  expect(Number.parseFloat(animationSettings.transitionDuration)).toBeCloseTo(
    0.00001,
    8,
  )
})

test("the Home bell and Settings inbox surface a task deadline", async ({
  page,
}) => {
  await registerShellUser(page)
  await page.goto("/quests")

  const laterTitle = `Later deadline ${randomUUID().slice(0, 8)}`
  const title = `Deadline alert ${randomUUID().slice(0, 8)}`
  const laterForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await laterForm.getByLabel("Task title").fill(laterTitle)
  await laterForm.getByRole("button", { name: "Today · 2 hours" }).click()
  await laterForm.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()

  await page.goto("/quests")
  const createForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await createForm.getByLabel("Task title").fill(title)
  await createForm.getByRole("button", { name: "Today · 2 hours" }).click()
  await createForm.getByLabel("Due time · IST").click()
  const dueSoonTime = DateTime.now()
    .setZone("Asia/Kolkata")
    .plus({ minutes: 25 })
    .toFormat("HH:mm")
  const exactDueTime = page.getByLabel("Due time · IST exact value")
  await exactDueTime.fill("")
  await exactDueTime.fill(dueSoonTime)
  await exactDueTime
    .locator("..")
    .getByRole("button", { name: "Use time" })
    .click()
  await createForm.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()

  await page.goto("/today")
  const notificationButton = page.getByRole("button", {
    name: "Open notifications, 1 unread",
  })
  await expect(notificationButton).toBeVisible()
  await notificationButton.click()

  const reminderDialog = page.getByRole("dialog", { name: "Notifications" })
  const alert = reminderDialog.getByRole("article", {
    name: `${title} deadline alert`,
  })
  const deadlineCopy =
    /Ends in (?:less than a minute|(?:[1-9]|1\d|2\d) minutes)\./u
  await expect(alert).toContainText(deadlineCopy)
  await expect(reminderDialog.getByText(laterTitle)).toHaveCount(0)
  const exactTaskLink = alert.getByRole("link", { name: "Open task" })
  await expect(exactTaskLink).toHaveAttribute(
    "href",
    /\/today\?date=\d{4}-\d{2}-\d{2}&task=[0-9a-f-]{36}$/u,
  )
  await exactTaskLink.click()
  await expect(page).toHaveURL(
    /\/today\?date=\d{4}-\d{2}-\d{2}&task=[0-9a-f-]{36}$/u,
  )
  await expect(reminderDialog).toBeHidden()
  const focusedTask = page.getByRole("article", { name: title, exact: true })
  await expect(focusedTask).toBeVisible()
  await expect(focusedTask).toBeFocused()
  await expect(focusedTask).toHaveAttribute("data-glowing", "true")
  await expect
    .poll(() =>
      focusedTask.evaluate(
        (task) => getComputedStyle(task, "::after").animationName,
      ),
    )
    .toBe("today-task-sheen")
  await expect(focusedTask).toHaveAttribute("data-glowing", "false", {
    timeout: 2_500,
  })
  await expect
    .poll(() =>
      focusedTask.evaluate(
        (task) => getComputedStyle(task, "::after").animationName,
      ),
    )
    .toBe("none")
  const focusedTaskId = new URL(page.url()).searchParams.get("task")
  expect(focusedTaskId).not.toBeNull()
  const removedDetailsRoute = await page.goto(`/quests/${focusedTaskId}`)
  expect(removedDetailsRoute?.status()).toBe(404)

  await page.goto("/today")
  await page.getByRole("button", { name: /^Open notifications/u }).click()
  const reopenedDialog = page.getByRole("dialog", { name: "Notifications" })
  const reopenedAlert = reopenedDialog.getByRole("article", {
    name: `${title} deadline alert`,
  })
  await reopenedAlert.getByRole("button", { name: "Mark read" }).click()
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "Open notifications" }),
  ).toBeVisible()

  await page.goto("/settings")
  await expect(
    page.getByRole("button", { name: /^Open notifications/u }),
  ).toHaveCount(0)
  const settingsAlert = page.getByRole("article", {
    name: `${title} deadline alert`,
  })
  await expect(settingsAlert).toContainText(deadlineCopy)
  const settingsInbox = page.getByRole("list", { name: "Reminder inbox" })
  await expect(settingsInbox.getByText(laterTitle)).toHaveCount(0)
  await expect(
    settingsAlert.getByRole("button", { name: "Mark read" }),
  ).toHaveCount(0)

  await page.goto("/today")
  await page.getByRole("button", { name: /^Open notifications/u }).click()
  const completionAlert = page
    .getByRole("dialog", { name: "Notifications" })
    .getByRole("article", { name: `${title} deadline alert` })
  await completionAlert.getByRole("link", { name: "Open task" }).click()
  await expect(page).toHaveURL(
    /\/today\?date=\d{4}-\d{2}-\d{2}&task=[0-9a-f-]{36}$/u,
  )

  const taskFromNotification = page.getByRole("article", {
    name: title,
    exact: true,
  })
  await taskFromNotification
    .getByRole("button", { name: `Clear ${title}` })
    .click()
  await expect(page).toHaveURL(/\/today\?date=\d{4}-\d{2}-\d{2}$/u)

  const completionDialog = page.getByRole("dialog").filter({ hasText: title })
  await completionDialog
    .getByRole("button", { name: /Continue|Keep going/u })
    .click()
  await expect(taskFromNotification).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Completed" })).toHaveCount(0)

  await page.getByRole("button", { name: /^Open notifications/u }).click()
  const refreshedInbox = page.getByRole("dialog", { name: "Notifications" })
  await expect(
    refreshedInbox.getByRole("article", {
      name: `${title} deadline alert`,
    }),
  ).toHaveCount(0)
  await expect(refreshedInbox.getByText("You're all caught up")).toBeVisible()
})

test("an active Home task can be swiped to Trash without a points penalty", async ({
  page,
}) => {
  await registerShellUser(page)
  await page.goto("/quests")

  const title = `Unneeded task ${randomUUID().slice(0, 8)}`
  const createForm = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await createForm.getByLabel("Task title").fill(title)
  await createForm.getByRole("button", { name: "Today · 2 hours" }).click()
  await createForm.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()

  await page.goto("/today")
  const task = page.getByRole("article", { name: title, exact: true })
  const shell = task.locator("..")
  const deleteTask = page.getByRole("button", {
    name: `Move ${title} to Trash`,
  })
  await expect(task).toBeVisible()
  await expect(deleteTask).toHaveCSS("opacity", "0")

  const box = await task.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  const startX = box.x + box.width * 0.75
  const y = box.y + box.height / 2
  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(startX - 90, y, { steps: 8 })
  await page.mouse.up()

  await expect(shell).toHaveAttribute("data-actions-open", "true")
  await expect(deleteTask).toHaveCSS("opacity", "1")
  await deleteTask.click()

  const deletedDialog = page.getByRole("dialog", { name: "Moved to Trash" })
  await expect(deletedDialog).toContainText("No points were deducted")
  await deletedDialog.getByRole("button", { name: "Continue" }).click()
  await expect(task).toHaveCount(0)

  await page.goto("/progress")
  await expect(
    page.getByRole("progressbar", { name: "Today: 0 of 0 points" }),
  ).toBeVisible()
  await expect(
    page.getByRole("progressbar", { name: "This week: 0 of 0 points" }),
  ).toBeVisible()
})
