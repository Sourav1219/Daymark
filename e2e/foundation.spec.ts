import { expect, test } from "@playwright/test"

test("redirects the root to sign-in and exposes the health endpoint", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page).toHaveURL(/\/sign-in$/)

  const response = await page.request.get("/api/health")
  expect(response.ok()).toBe(true)
  await expect(response.json()).resolves.toMatchObject({
    service: "daymark",
    status: "ok",
  })

  await page.goto("/profile")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile$/u)
})
