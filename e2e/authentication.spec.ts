import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test("registers, enters Today, logs out, and logs in", async ({
  context,
  page,
}) => {
  const email = `e2e-${randomUUID()}@example.com`
  const password = "correct-horse-battery-staple"

  await page.goto("/app")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/u)

  await page.getByRole("button", { name: "Get started" }).click()
  await page.getByLabel("Name").fill("E2E Operator")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.locator("#termsAccepted").check()
  await page.locator("#privacyNoticeAcknowledged").check()
  await page.getByRole("button", { name: "Create" }).click()
  await completeEmailVerification(page)

  await expect(page).toHaveURL(/\/today$/u)
  await expect(
    page.getByText("Daily activity", { exact: true }).first(),
  ).toBeVisible()

  const sessionCookie = (await context.cookies()).find((cookie) =>
    cookie.name.endsWith("questly.session_token"),
  )
  expect(sessionCookie).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
  })

  await page.goto(`/app/workspaces/${randomUUID()}`)
  await expect(
    page.getByRole("heading", {
      name: "This workspace is outside your access boundary.",
    }),
  ).toBeVisible()

  await page.goto("/app")
  await expect(page).toHaveURL(/\/today$/u)
  await page.getByRole("link", { name: "Profile" }).click()
  await page.getByRole("button", { name: "Log out" }).click()
  await expect(page).toHaveURL(/\/sign-out\?next=%2Ftoday$/u)
  await expect(
    page.getByRole("heading", { name: "You have been signed out." }),
  ).toBeVisible()
  await page.getByRole("link", { name: "Sign in again" }).click()
  await expect(page).toHaveURL(/\/sign-in\?mode=login&next=%2Ftoday$/u)

  await context.addCookies([
    {
      httpOnly: true,
      name: "questly.session_token",
      sameSite: "Lax",
      url: new URL(page.url()).origin,
      value: "invalid-session-token",
    },
  ])
  await page.goto("/app")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/u)
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible()

  await context.clearCookies({ name: /questly\.session_token$/u })
  await page.goto("/app")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/u)
  await page.getByRole("button", { name: "I already have an account" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Enter" }).click()

  await expect(page).toHaveURL(/\/today$/u)
  await expect(
    page.getByText("Daily activity", { exact: true }).first(),
  ).toBeVisible()
})

test("keeps sign-up and sign-in states separate and reports duplicate accounts", async ({
  page,
}) => {
  const email = `e2e-${randomUUID()}@example.com`
  const password = "correct-horse-battery-staple"

  await page.goto("/sign-in")
  await page.getByRole("button", { name: "I already have an account" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Enter" }).click()
  await expect(page.locator(".auth__error")).toHaveText(
    "Sign-in was unsuccessful. Please try again.",
  )

  await page.getByRole("button", { name: "Register" }).click()
  await expect(page.locator(".auth__error")).toHaveCount(0)
  await page.getByLabel("Name").fill("Auth State E2E")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.locator("#termsAccepted").check()
  await page.locator("#privacyNoticeAcknowledged").check()
  await page.getByRole("button", { name: "Create" }).click()
  await completeEmailVerification(page)

  await page.getByRole("link", { name: "Profile" }).click()
  await page.getByRole("button", { name: "Log out" }).click()
  await expect(page).toHaveURL(/\/sign-out\?next=%2Ftoday$/u)
  await page.getByRole("link", { name: "Sign in again" }).click()
  await expect(page).toHaveURL(/\/sign-in\?mode=login&next=%2Ftoday$/u)

  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Duplicate Auth E2E")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.locator("#termsAccepted").check()
  await page.locator("#privacyNoticeAcknowledged").check()
  await page.getByRole("button", { name: "Create" }).click()
  await expect(
    page.getByRole("heading", { name: "Check your inbox." }),
  ).toBeVisible()
  await expect(
    page.getByText("An account with this email already exists", {
      exact: false,
    }),
  ).toHaveCount(0)

  await page.getByRole("button", { name: "Back to sign in" }).click()
  await expect(page.locator(".auth__error")).toHaveCount(0)
  await page.getByLabel("Email").fill(email)
  await page
    .getByLabel("Password", { exact: true })
    .fill("definitely-the-wrong-password")
  await page.getByRole("button", { name: "Enter" }).click()
  await expect(page.locator(".auth__error")).toHaveText(
    "Sign-in was unsuccessful. Please try again.",
  )

  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Enter" }).click()
  await expect(page).toHaveURL(/\/today$/u)
})
