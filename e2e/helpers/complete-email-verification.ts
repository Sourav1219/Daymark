import { expect, type Page } from "@playwright/test"

export const e2eVerificationCode = "481516"

export async function completeEmailVerification(
  page: Page,
  expectedUrl: RegExp = /\/today$/u,
) {
  await expect(
    page.getByRole("heading", { name: "Check your inbox." }),
  ).toBeVisible()
  await page.getByLabel("Verification code").fill(e2eVerificationCode)
  await page.getByRole("button", { name: "Verify email" }).click()
  await expect(page).toHaveURL(expectedUrl, { timeout: 30_000 })
}
