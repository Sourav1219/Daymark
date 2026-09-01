import { expect, test } from "@playwright/test"

const consentCookieName = "traketo_cookie_consent"

test.beforeEach(async ({ context, page }) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await context.clearCookies()
})

test("does not show an intrusive popup dialog when a first-time visitor opens the site", async ({
  page,
}) => {
  await page.goto("http://localhost:3000/")

  await expect(page).toHaveURL(/\/sign-in$/)
  const consentDialog = page.getByRole("dialog", {
    name: "Cookies & privacy",
  })
  await expect(consentDialog).toHaveCount(0)
})

test("allows opening cookie preferences on demand from the privacy page", async ({
  context,
  page,
}) => {
  await page.goto("http://localhost:3000/privacy")

  const consentDialog = page.getByRole("dialog", {
    name: "Cookies & privacy",
  })
  await expect(consentDialog).toHaveCount(0)

  await page.getByRole("button", { name: /Cookie settings/i }).click()
  await expect(consentDialog).toBeVisible()
  await expect(
    consentDialog.getByRole("button", { name: "Allow Cookies" }),
  ).toBeVisible()
  await expect(
    consentDialog.getByRole("button", { name: "Decline optional cookies" }),
  ).toBeVisible()

  await consentDialog
    .getByRole("button", { name: "Decline optional cookies" })
    .click()
  await expect(consentDialog).toBeHidden()

  await expect
    .poll(async () => {
      const consentCookie = (await context.cookies()).find(
        ({ name }) => name === consentCookieName,
      )
      return consentCookie?.value
    })
    .toBe("v1.essential")
})
