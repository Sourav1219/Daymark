import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

test.use({ locale: "en-IN", timezoneId: "Asia/Kolkata" })

test("sends a new account directly home without an onboarding overlay", async ({
  page,
}) => {
  await page.goto("/sign-up?next=%2Fprofile")
  await page.getByLabel("Name").fill("First Run Student")
  await page.getByLabel("Email").fill(`onboarding-${randomUUID()}@example.com`)
  await page.getByLabel("Password").fill("correct-horse-battery-staple")
  await page.getByRole("button", { name: "Create" }).click()

  await expect(page).toHaveURL(/\/today$/u)
  await expect(
    page.getByText("Daily activity", { exact: true }).first(),
  ).toBeVisible()
  await expect(
    page.getByRole("complementary", { name: "Getting started" }),
  ).toHaveCount(0)
})
