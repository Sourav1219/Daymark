import { expect, test } from "@playwright/test"

test("installs the worker, queues offline creation, recovers, and clears private data", async ({
  context,
  page,
  request,
}) => {
  const manifest = await request.get("/manifest.webmanifest")
  expect(manifest.ok()).toBe(true)
  await expect(manifest.json()).resolves.toMatchObject({
    display: "standalone",
    icons: expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ purpose: "maskable", sizes: "512x512" }),
    ]),
    name: "Daymark — Tasks & Habits",
  })

  const email = `phase8-${Date.now()}@example.com`
  const password = "OfflinePhase8!2026"
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Offline Operator")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)

  await page.goto("/quests")
  await page.getByLabel("Task title").fill("Online cached task")
  await page.getByRole("button", { name: "Create Task", exact: true }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("tab", { name: /Search/u }).click()
  await page
    .getByRole("searchbox", { name: "Search" })
    .fill("Online cached task")
  await expect(page).toHaveURL(/search=Online(?:\+|%20)cached/u)
  await expect(
    page.getByRole("article", { name: "Online cached task", exact: true }),
  ).toBeVisible()

  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return false
    await navigator.serviceWorker.ready
    return true
  })
  if (
    !(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
  ) {
    await page.reload()
  }
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const databases = await indexedDB.databases()
        return databases.some(({ name }) => name === "questly-private-offline")
      }),
    )
    .toBe(true)

  await page.waitForLoadState("networkidle")

  await context.setOffline(true)
  await expect(page.getByText(/Offline — recent tasks/u)).toBeVisible()
  await page
    .getByRole("button", { name: "Complete Online cached task" })
    .click()
  await expect(
    page.getByRole("article", { name: "Online cached task", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("tab", { name: /Create/u }).click()
  await page.getByLabel("Task title").fill("Queued offline task")
  await page.getByRole("button", { name: "Create Task", exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open("questly-private-offline")
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const database = request.result
              const mutations = database
                .transaction("mutations")
                .objectStore("mutations")
                .getAll()
              mutations.onerror = () => reject(mutations.error)
              mutations.onsuccess = () => {
                database.close()
                resolve(mutations.result.length)
              }
            }
          }),
      ),
    )
    .toBe(2)
  await expect(page.getByText(/2 changes queued/u)).toBeVisible()
  await page.getByRole("tab", { name: /Search/u }).click()
  await page
    .getByRole("searchbox", { name: "Search" })
    .fill("Queued offline task")
  await expect(
    page.getByRole("article", { name: "Queued offline task", exact: true }),
  ).toBeVisible()

  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("heading", { name: "Offline tasks" }),
  ).toBeVisible()
  await expect(
    page.getByText("Online cached task", { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText("Queued offline task", { exact: true }),
  ).toBeVisible()

  await context.setOffline(false)
  await page.goto("/quests")
  await page.getByRole("tab", { name: /Search/u }).click()
  await page
    .getByRole("searchbox", { name: "Search" })
    .fill("Queued offline task")
  await expect(
    page.getByRole("article", { name: "Queued offline task", exact: true }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(
    page.getByRole("article", { name: "Online cached task", exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText(/change queued/u)).toHaveCount(0)

  await page.getByRole("link", { name: "Profile" }).click()
  await page.getByRole("button", { name: "Log out" }).click()
  await expect(page).toHaveURL(/\/sign-in$/u)
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const databases = await indexedDB.databases()
        return databases.some(({ name }) => name === "questly-private-offline")
      }),
    )
    .toBe(false)
})
