import { expect, test } from "@playwright/test"

test("redirects the root to sign-in and exposes the health endpoint", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  await page.goto("/")

  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByText("Turn plans into progress.")).toBeVisible()
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0)

  const response = await page.request.get("/api/health")
  expect(response.ok()).toBe(true)
  await expect(response.json()).resolves.toMatchObject({
    service: "traketo",
    status: "ok",
  })

  await page.goto("/profile")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile$/u)

  await page.goto("/sign-up")
  await expect(page.getByText("Your data, in plain language")).toHaveCount(0)
  await expect(page.locator(".auth__turnstile")).toHaveCount(0)
  await expect(page.locator(".auth__agreements")).toHaveCount(1)
  await expect(page.locator(".auth__agreements + .auth__submit")).toHaveCount(1)
  const terms = page.getByRole("checkbox", {
    name: /I confirm I am 18 or older and accept the Terms of Service/u,
  })
  const privacy = page.getByRole("checkbox", {
    name: /I have read the Privacy Notice/u,
  })
  await expect(terms).toBeVisible()
  await expect(privacy).toBeVisible()
  await expect(page.getByRole("button", { name: "Create" })).toBeDisabled()

  await terms.check()
  await privacy.check()
  await expect(page.locator('input[name="termsAccepted"]')).toHaveValue("on")
  await expect(
    page.locator('input[name="privacyNoticeAcknowledged"]'),
  ).toHaveValue("on")
  const optionalConsentCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "traketo_cookie_consent",
  )
  expect(optionalConsentCookie?.value).toBe("v1.essential")
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})
