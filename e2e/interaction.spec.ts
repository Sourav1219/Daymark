import { randomUUID } from "node:crypto"

import { expect, test, type Page } from "@playwright/test"

async function register(page: Page, label: string) {
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill(`${label} Operator`)
  await page.getByLabel("Email").fill(`${label}-${randomUUID()}@example.com`)
  await page.getByLabel("Password").fill("correct-horse-battery-staple")
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)
}

async function createQuest(page: Page, title: string) {
  await page.getByRole("tab", { name: /Create/u }).click()
  const form = page.locator("form", {
    has: page.getByRole("button", { name: "Create Task" }),
  })
  await form.getByLabel("Task title").fill(title)
  await form.getByRole("button", { name: "Create Task" }).click()
  await page.getByRole("link", { name: "Continue" }).click()
  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  const arrange = page.getByRole("button", { name: "Arrange all tasks" })
  if (await arrange.isVisible()) await arrange.click()
  const article = page.getByRole("article", { name: title })
  await expect(
    page.locator('[data-quest-order-id][tabindex="0"]', { has: article }),
  ).toBeVisible()
}

async function visibleQuestOrder(page: Page) {
  return page
    .getByRole("article")
    .evaluateAll((articles) =>
      articles.map(
        (article) =>
          article.querySelector('[data-slot="card-title"]')?.textContent ?? "",
      ),
    )
}

test("creates and clears a Quest with keyboard-only Quest controls", async ({
  page,
}) => {
  const title = `Keyboard Quest ${randomUUID().slice(0, 8)}`
  await register(page, "keyboard")

  await expect(page.locator("html[data-shortcuts-ready='true']")).toBeAttached()
  await page.keyboard.press("n")
  await expect(page).toHaveURL(/\/quests#create-quest-title$/u)
  const titleField = page.getByLabel("Task title")
  await expect(titleField).toBeFocused()
  await titleField.pressSequentially(title)

  await page.route("**/quests", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 450))
    }
    await route.continue()
  })
  await page.keyboard.press("Control+Enter")
  await expect(page.getByLabel("Task is saving")).toBeVisible()
  await expect(page.getByLabel("Task is saving")).toBeHidden()
  await page.getByRole("link", { name: "Continue" }).click()
  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("searchbox", { name: "Search" }).fill(title)

  const quest = page.getByRole("article", { name: title })
  await expect(quest).toBeVisible()
  const listItem = page.locator('[data-quest-order-id][tabindex="0"]', {
    has: quest,
  })
  await listItem.focus()
  await expect(listItem).toBeFocused()
  await page.keyboard.press("c")
  await expect(
    page.getByRole("dialog", { name: "Task complete!" }),
  ).toBeVisible()

  await page.goto("/cleared")
  await expect(page.getByRole("article", { name: title })).toBeVisible()
})

test("persists drag-and-drop and keyboard Quest ordering", async ({ page }) => {
  const suffix = randomUUID().slice(0, 8)
  const first = `First ordered Quest ${suffix}`
  const second = `Second ordered Quest ${suffix}`
  const third = `Third ordered Quest ${suffix}`
  await register(page, "ordering")
  await page.goto("/quests")
  await createQuest(page, first)
  await createQuest(page, second)
  await createQuest(page, third)

  const thirdHandle = page.getByRole("button", {
    name: `Drag ${third} to reorder`,
  })
  const firstDropTarget = page.locator("[data-quest-order-id]", {
    has: page.getByRole("article", { name: first }),
  })
  await thirdHandle.dragTo(firstDropTarget)
  await expect(
    page.getByRole("status").filter({
      hasText: `${third} moved and its order was saved.`,
    }),
  ).toContainText("moved and its order was saved")
  await page.reload()
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("button", { name: "Arrange all tasks" }).click()
  await expect
    .poll(() => visibleQuestOrder(page))
    .toEqual([third, first, second])

  const keyboardHandle = page.getByRole("button", {
    name: `Drag ${third} to reorder`,
  })
  await keyboardHandle.focus()
  await page.keyboard.press("Alt+ArrowDown")
  await expect(
    page.getByRole("status").filter({
      hasText: `${third} moved and its order was saved.`,
    }),
  ).toContainText("moved and its order was saved")
  await page.reload()
  await page.getByRole("tab", { name: /Search/u }).click()
  await page.getByRole("button", { name: "Arrange all tasks" }).click()
  await expect
    .poll(() => visibleQuestOrder(page))
    .toEqual([first, third, second])
})

test("rolls an optimistic reorder back when versions conflict", async ({
  context,
  page,
}) => {
  const suffix = randomUUID().slice(0, 8)
  const first = `Conflict first ${suffix}`
  const updatedFirst = `${first} updated`
  const second = `Conflict second ${suffix}`
  await register(page, "rollback")
  await page.goto("/quests")
  await createQuest(page, first)
  await createQuest(page, second)

  const stalePage = await context.newPage()
  await stalePage.goto("/quests")
  await stalePage.getByRole("tab", { name: /Search/u }).click()
  await stalePage.getByRole("button", { name: "Arrange all tasks" }).click()

  const firstQuest = page.getByRole("article", { name: first })
  await firstQuest.getByText("Edit Task", { exact: true }).click()
  const editForm = firstQuest.locator("details[open] form").first()
  await editForm.getByLabel("Task title").fill(updatedFirst)
  await editForm.getByRole("button", { name: "Save changes" }).click()
  await expect(
    page.getByText("Task details updated", { exact: true }),
  ).toBeVisible()

  await stalePage.route("**/quests", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 450))
    }
    await route.continue()
  })
  await stalePage.getByRole("button", { name: `Move ${second} up` }).click()
  await expect.poll(() => visibleQuestOrder(stalePage)).toEqual([second, first])
  await expect(
    stalePage.getByText(
      "A task was updated elsewhere. The previous order was restored.",
      { exact: true },
    ),
  ).toBeVisible()
  await expect
    .poll(() => visibleQuestOrder(stalePage))
    .toEqual([updatedFirst, second])
  await stalePage.close()
})
