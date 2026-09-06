import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"
import { hashPassword } from "better-auth/crypto"
import postgres from "postgres"

test("creates a named custom task and limits Home filter facets", async ({
  page,
}) => {
  test.skip(
    !process.env.DATABASE_URL,
    "Requires the migrated development database",
  )
  test.setTimeout(120_000)
  page.setDefaultTimeout(15_000)

  const database = postgres(process.env.DATABASE_URL!, {
    max: 1,
    prepare: false,
  })
  const userId = randomUUID()
  const workspaceId = randomUUID()
  const email = `custom-filter-${userId}@example.com`
  const password = "Traketo-custom-filter-2026!"

  try {
    const passwordHash = await hashPassword(password)
    await database.begin(async (sql) => {
      await sql`insert into users (id, name, email, email_verified) values (${userId}, 'Custom Filter Test', ${email}, true)`
      await sql`insert into accounts (account_id, provider_id, user_id, password) values (${userId}, 'credential', ${userId}, ${passwordHash})`
      await sql`insert into workspaces (id, owner_user_id, name, slug) values (${workspaceId}, ${userId}, 'Custom Filter Workspace', ${`custom-filter-${userId}`})`
      await sql`insert into workspace_members (workspace_id, user_id, role) values (${workspaceId}, ${userId}, 'owner')`
      await sql`insert into user_settings (user_id) values (${userId})`
      await sql`insert into user_progression (workspace_id, user_id) values (${workspaceId}, ${userId})`
    })

    await page.goto("/sign-in?mode=login")
    await page.getByLabel("Email", { exact: true }).fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByRole("button", { name: "Enter", exact: true }).click()
    await expect(page).toHaveURL(/\/today$/u, { timeout: 30_000 })
    await expect(page.getByText("Keep your streak alive")).toBeVisible()

    const repeatClaim = page.waitForResponse(
      (response) =>
        response.url().includes("/today") &&
        response.request().method() === "POST" &&
        Boolean(response.request().headers()["next-action"]),
    )
    await page.reload()
    await repeatClaim
    await expect(page.getByText("Keep your streak alive")).toHaveCount(0)

    await database`update user_settings set today_promo_shown_on = '2000-01-01' where user_id = ${userId}`
    const nextDayClaim = page.waitForResponse(
      (response) =>
        response.url().includes("/today") &&
        response.request().method() === "POST" &&
        Boolean(response.request().headers()["next-action"]),
    )
    await page.reload()
    await nextDayClaim
    await expect(page.getByText("Keep your streak alive")).toBeVisible()

    await page.goto("/quests")
    await page.getByRole("tab", { name: /Create/u }).click()
    const form = page.locator("form", {
      has: page.getByRole("button", { name: "Create Task", exact: true }),
    })
    await form.getByLabel("Task title", { exact: true }).fill("Morning run")
    await form.getByText("Custom", { exact: true }).click()
    await form.getByPlaceholder("Enter custom task type…").fill("Fitness")
    await form.getByRole("button", { name: "Create Task", exact: true }).click()
    await expect(
      form.getByText(/systems could not complete the request/u),
    ).toHaveCount(0)

    await database`insert into tasks (
      workspace_id,
      created_by_user_id,
      title,
      description,
      task_type,
      type_manual,
      status,
      priority,
      position
    ) values (
      ${workspaceId},
      ${userId},
      'Buy groceries',
      '',
      'personal',
      true,
      'open',
      'low',
      1
    )`
    await page.getByRole("link", { name: "Continue", exact: true }).click()
    await page.goto("/quests")
    await expect(page.getByLabel("Parent task")).toHaveCount(0)
    await page.goto("/today")

    await expect(
      page.getByRole("article", { name: "Morning run", exact: true }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Type", exact: true }).click()
    const typePanel = page.getByRole("region", {
      name: "Task type",
      exact: true,
    })
    await expect(typePanel.getByRole("button", { name: "Any" })).toBeVisible()
    await expect(
      typePanel.getByRole("button", { name: "Fitness" }),
    ).toBeVisible()
    await expect(typePanel.getByRole("button", { name: "Custom" })).toHaveCount(
      0,
    )
    await expect(
      typePanel.getByRole("button", { name: "Personal" }),
    ).toBeVisible()
    await typePanel.getByRole("button", { name: "Fitness" }).click()

    await expect(
      page.getByRole("button", { name: "Fitness", exact: true }),
    ).toHaveAttribute("data-type", "custom")
    await page.getByRole("button", { name: "Priority", exact: true }).click()
    const priorityPanel = page.getByRole("region", {
      name: "Priority",
      exact: true,
    })
    await expect(
      priorityPanel.getByRole("button", { name: "Any" }),
    ).toBeVisible()
    await expect(
      priorityPanel.getByRole("button", { name: "Medium" }),
    ).toBeVisible()
    await expect(
      priorityPanel.getByRole("button", { name: "Low" }),
    ).toBeVisible()
    await priorityPanel.getByRole("button", { name: "Medium" }).click()

    await page.getByRole("button", { name: "Fitness", exact: true }).click()
    await expect(
      typePanel.getByRole("button", { name: "Personal" }),
    ).toBeVisible()
    await typePanel.getByRole("button", { name: "Close filters" }).click()
    await page.getByRole("button", { name: "Medium", exact: true }).click()
    await expect(
      priorityPanel.getByRole("button", { name: "Low" }),
    ).toBeVisible()
    await priorityPanel.getByRole("button", { name: "Close filters" }).click()
    await page.getByRole("button", { name: "All", exact: true }).click()

    const task = page.getByRole("article", {
      name: "Morning run",
      exact: true,
    })
    await task.getByRole("button", { name: /^Classify Morning run:/u }).click()
    const classificationPanel = task.getByLabel(
      "Classification for Morning run",
    )
    await classificationPanel
      .getByRole("button", { name: "Study", exact: true })
      .click()
    await expect(classificationPanel).toBeVisible()
    const highPriority = classificationPanel.getByRole("button", {
      name: "High",
      exact: true,
    })
    await expect(classificationPanel.getByRole("status")).toHaveText(
      "Your choice is saved.",
      { timeout: 15_000 },
    )
    await expect(highPriority).toBeEnabled()
    await highPriority.click()
    await expect(classificationPanel).toBeVisible()
    await expect(classificationPanel.getByRole("status")).toHaveText(
      "Your choice is saved.",
      { timeout: 15_000 },
    )
    await classificationPanel
      .getByRole("button", { name: "Done editing classification" })
      .click()
    await expect(classificationPanel).toHaveCount(0)
  } finally {
    await database.begin(async (sql) => {
      await sql`delete from tasks where workspace_id = ${workspaceId}`
      await sql`delete from user_progression where workspace_id = ${workspaceId}`
      await sql`delete from user_settings where user_id = ${userId}`
      await sql`delete from workspace_members where workspace_id = ${workspaceId}`
      await sql`delete from accounts where user_id = ${userId}`
      await sql`delete from workspaces where id = ${workspaceId}`
      await sql`delete from users where id = ${userId}`
    })
    await database.end()
  }
})
