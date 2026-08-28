import { expect, test } from "@playwright/test"

const consentCookieName = "traketo_cookie_consent"

test.beforeEach(async ({ context, page }) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await context.clearCookies()
})

test("shows consent immediately when a first-time visitor opens the main URL", async ({
  page,
}) => {
  await page.goto("http://localhost:3000/")

  await expect(page).toHaveURL(/\/sign-in$/)
  const consentDialog = page.getByRole("dialog", {
    name: "Cookies & privacy",
  })
  await expect(consentDialog).toBeVisible()
  await expect(
    consentDialog.getByRole("button", { name: "Allow Cookies" }),
  ).toBeVisible()
  await expect(
    consentDialog.getByRole("button", { name: "Decline optional cookies" }),
  ).toBeVisible()
})

test("shows on direct sign-in and reopens on the next development load", async ({
  context,
  page,
}, testInfo) => {
  await page.goto("http://localhost:3000/sign-in")

  const consentDialog = page.getByRole("dialog", {
    name: "Cookies & privacy",
  })
  await expect(consentDialog).toBeVisible()
  await expect(
    page.getByRole("button", { name: "I already have an account" }),
  ).toBeVisible()

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("cookie-consent-mobile.png"),
  })

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

  await page.reload()
  await expect(consentDialog).toBeVisible()

  await consentDialog.getByRole("button", { name: "Allow Cookies" }).click()
  await page.goto("http://localhost:3000/")
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(consentDialog).toBeVisible()

  await expect(
    page.locator("[data-nextjs-dialog], .vite-error-overlay"),
  ).toHaveCount(0)
})
