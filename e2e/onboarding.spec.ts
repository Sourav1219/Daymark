import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test.use({ locale: "en-IN", timezoneId: "Asia/Kolkata" })

test("sends a new account to its safe destination without an onboarding overlay", async ({
  page,
}) => {
  await page.goto("/sign-up?next=%2Fprofile")
  await page.getByLabel("Name").fill("First Run Student")
  await page.getByLabel("Email").fill(`onboarding-${randomUUID()}@example.com`)
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery-staple")
  await page.locator("#termsAccepted").check()
  await page.locator("#privacyNoticeAcknowledged").check()
  await page.getByRole("button", { name: "Create" }).click()
  await completeEmailVerification(page, /\/profile$/u)

  await expect(page).toHaveURL(/\/profile$/u)
  await expect(
    page.getByRole("heading", { name: "Your profile" }),
  ).toBeVisible()
  await expect(
    page.getByRole("complementary", { name: "Getting started" }),
  ).toHaveCount(0)
})
