import { expect, test } from "@playwright/test"

const consentCookieName = "traketo_cookie_consent"

test.beforeEach(async ({ context, page }) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await context.clearCookies()
})

test("offers equal consent choices to a first-time visitor", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page).toHaveURL(/\/sign-in$/)
  const consentDialog = page.getByRole("dialog", {
    name: "Cookies & privacy",
  })
  await expect(consentDialog).toBeVisible()
  await expect(
    consentDialog.getByRole("button", { name: "Accept all" }),
  ).toBeVisible()
  await expect(
    consentDialog.getByRole("button", { name: "Essential only" }),
  ).toBeVisible()
})

test("allows opening cookie preferences on demand from the privacy page", async ({
  context,
  page,
}) => {
  await page.goto("/privacy")

  const initialDialog = page.getByRole("dialog", {
    name: "Cookies & privacy",
  })
  await initialDialog.getByRole("button", { name: "Essential only" }).click()
  await expect(initialDialog).toBeHidden()

  await page.getByRole("button", { name: /Cookie settings/i }).click()
  const consentDialog = page.getByRole("dialog", {
    name: "Manage cookie choices",
  })
  await expect(consentDialog).toBeVisible()
  await expect(
    consentDialog.getByRole("button", { name: "Save choices" }),
  ).toBeVisible()
  await expect(
    consentDialog.getByRole("button", {
      name: "Essential cookies only (withdraw consent)",
    }),
  ).toBeVisible()

  await consentDialog
    .getByRole("button", {
      name: "Essential cookies only (withdraw consent)",
    })
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
