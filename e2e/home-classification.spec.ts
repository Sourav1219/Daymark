import { randomUUID } from "node:crypto"
import { test, expect } from "@playwright/test"
import postgres from "postgres"
import { hashPassword } from "better-auth/crypto"

test("Home classification, independent history pages, and recovery", async ({
  page,
}) => {
  test.skip(
    !process.env.DATABASE_URL,
    "Requires the migrated development database",
  )
  test.setTimeout(180_000)
  page.setDefaultTimeout(15_000)
  const email = `home-classification-${randomUUID()}@example.com`
  const setup = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 })
  const userId = randomUUID()
  const workspaceId = randomUUID()
  const password = await hashPassword("Traketo-classification-test-2026!")
  try {
    await setup.begin(async (sql) => {
      await sql`insert into users (id, name, email, email_verified) values (${userId}, 'Home Classification Test', ${email}, true)`
      await sql`insert into accounts (account_id, provider_id, user_id, password) values (${userId}, 'credential', ${userId}, ${password})`
      await sql`insert into workspaces (id, owner_user_id, name, slug) values (${workspaceId}, ${userId}, 'Home Test Workspace', ${"personal-" + userId})`
      await sql`insert into workspace_members (workspace_id, user_id, role) values (${workspaceId}, ${userId}, 'owner')`
      await sql`insert into user_settings (user_id) values (${userId})`
      await sql`insert into user_progression (workspace_id, user_id) values (${workspaceId}, ${userId})`
    })
  } finally {
    await setup.end()
  }
  await page.goto("/sign-in")
  await page
    .getByRole("button", { name: "I already have an account", exact: true })
    .click()
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page
    .getByLabel("Password", { exact: true })
    .fill("Traketo-classification-test-2026!")
  await page.getByRole("button", { name: "Enter", exact: true }).click()
  await expect(page).toHaveURL(/\/today$/u, { timeout: 30_000 })

  // Create through the real form, exercising the generated INSERT and rules.
  await page.goto("/quests")
  await page.getByRole("tab", { name: /Create/u }).click()
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Reply to client email")
  await page.getByRole("button", { name: "Create Task", exact: true }).click()
  await page.getByRole("link", { name: "Continue", exact: true }).click()
  const work = page.getByRole("article", {
    name: "Reply to client email",
    exact: true,
  })
  await expect(work.getByText("Work · Light effort")).toBeVisible()
  await work.getByRole("button", { name: /^Classify/u }).click()
  await work.getByRole("button", { name: "Study", exact: true }).click()
  await expect(
    work.getByRole("button", { name: "Study", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await work.getByRole("button", { name: "Deep focus", exact: true }).click()
  await expect(
    work.getByText("Study · Deep focus", { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    work.getByText("Study · Deep focus", { exact: true }),
  ).toBeVisible()

  const db = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 })
  try {
    const [scope] =
      await db`select u.id as user_id, m.workspace_id from users u join workspace_members m on m.user_id = u.id where u.email = ${email} and m.deleted_at is null limit 1`
    if (!scope) throw new Error("Fixture workspace missing")
    const [saved] =
      await db`select task_type, effort, type_manual, effort_manual, priority from tasks where workspace_id = ${scope.workspace_id} and title = 'Reply to client email'`
    expect(saved).toMatchObject({
      task_type: "study",
      effort: "deep",
      type_manual: true,
      effort_manual: true,
      priority: "medium",
    })
    const now = Date.now()
    const day = 86_400_000
    const base = {
      workspace_id: scope.workspace_id,
      created_by_user_id: scope.user_id,
      priority: "medium",
      task_type: "personal",
      effort: "light",
    }
    const rows = [
      ...Array.from({ length: 22 }, (_, i) => ({
        ...base,
        id: randomUUID(),
        title: `Completed fixture ${i}`,
        status: "completed",
        completed_at: new Date(now - (i + 1) * day),
        due_at: null,
        deleted_at: null,
        position: i,
      })),
      ...Array.from({ length: 22 }, (_, i) => ({
        ...base,
        id: randomUUID(),
        title: `Deleted fixture ${i}`,
        status: "open",
        completed_at: null,
        due_at: null,
        deleted_at: new Date(now - (i + 1) * 60_000),
        position: i,
      })),
      {
        ...base,
        id: randomUUID(),
        title: "Earlier unresolved miss",
        status: "open",
        completed_at: null,
        due_at: new Date(now - 40 * day),
        deleted_at: null,
        position: 0,
      },
      {
        ...base,
        id: randomUUID(),
        title: "Buy detergent",
        status: "open",
        completed_at: null,
        due_at: null,
        deleted_at: null,
        position: 500,
      },
      {
        ...base,
        id: randomUUID(),
        title: "Expired recovery fixture",
        status: "open",
        completed_at: null,
        due_at: null,
        deleted_at: new Date(now - 31 * day),
        position: 0,
      },
    ]
    await db`insert into tasks ${db(rows)}`
    await page.goto("/today")
    await expect(
      page.getByRole("article", { name: "Buy detergent", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("article", {
        name: "Earlier unresolved miss",
        exact: true,
      }),
    ).toBeAttached()
    await expect(
      page.getByText("Completed fixture 0", { exact: true }),
    ).toBeAttached()
    await expect(
      page.getByText("Deleted fixture 0", { exact: true }),
    ).toBeAttached()
    await expect(page.getByText("Expired recovery fixture")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Show more completed", exact: true }),
    ).toBeAttached()
    await expect(
      page.getByRole("button", {
        name: "Show more recently deleted",
        exact: true,
      }),
    ).toBeAttached()
    await page
      .getByRole("button", { name: "Show more completed", exact: true })
      .click()
    await expect(
      page.getByText("Completed fixture 21", { exact: true }),
    ).toBeAttached()
    await expect(
      page.getByText("Deleted fixture 21", { exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: "Show more recently deleted", exact: true })
      .click()
    await expect(
      page.getByText("Deleted fixture 21", { exact: true }),
    ).toBeAttached()

    await page.getByRole("button", { name: "Type", exact: true }).click()
    await page
      .getByRole("region", { name: "Task type", exact: true })
      .getByRole("button", { name: "Study", exact: true })
      .click()
    await expect(
      page.getByRole("article", { name: "Buy detergent", exact: true }),
    ).toHaveCount(0)
    await expect(work).toBeVisible()
    await page
      .getByRole("button", { name: "Effort · Any", exact: true })
      .click()
    await page
      .getByRole("region", { name: "Task effort", exact: true })
      .getByRole("button", { name: "Light effort", exact: true })
      .click()
    await expect(work).toHaveCount(0)
    await page.getByRole("button", { name: "All", exact: true }).click()
    await expect(work).toBeAttached()

    const missed = page.getByRole("article", {
      name: "Earlier unresolved miss",
      exact: true,
    })
    await missed
      .getByRole("button", { name: "Reschedule", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Reschedule task", exact: true })
      .click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await expect(
      missed.getByRole("button", {
        name: "Clear Earlier unresolved miss",
        exact: true,
      }),
    ).toBeAttached()
    const deleted = page.getByRole("article", {
      name: "Deleted: Deleted fixture 0",
      exact: true,
    })
    await deleted.getByRole("button", { name: "Restore", exact: true }).click()
    await expect(deleted).toHaveCount(0)
    await expect(
      page.getByRole("article", { name: "Deleted fixture 0", exact: true }),
    ).toBeAttached()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("button", { name: "Type", exact: true }).click()
    await expect(page.getByRole("region", { name: "Task type" })).toBeVisible()
    await page.screenshot({
      path: "/tmp/traketo-home-mobile.png",
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  } finally {
    await db.end()
  }
})
