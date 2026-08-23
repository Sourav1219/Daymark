import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

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
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Create" }).click()

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
  await expect(page).toHaveURL(/\/sign-in$/u)

  await context.addCookies([
    {
      httpOnly: true,
      name: "questly.session_token",
      sameSite: "Lax",
      url: "http://127.0.0.1:3000",
      value: "invalid-session-token",
    },
  ])
  await page.goto("/app")
  await expect(
    page.getByRole("heading", { name: "Your session is missing or expired." }),
  ).toBeVisible()

  await context.clearCookies()
  await page.goto("/app")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/u)
  await page.getByRole("button", { name: "I already have an account" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
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
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Enter" }).click()
  await expect(page.locator(".auth__error")).toHaveText(
    "Email or password is incorrect. Check your details and try again.",
  )

  await page.getByRole("button", { name: "Register" }).click()
  await expect(page.locator(".auth__error")).toHaveCount(0)
  await page.getByLabel("Name").fill("Auth State E2E")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL(/\/today$/u)

  await page.getByRole("link", { name: "Profile" }).click()
  await page.getByRole("button", { name: "Log out" }).click()
  await expect(page).toHaveURL(/\/sign-in$/u)

  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Duplicate Auth E2E")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page.locator(".auth__error")).toHaveText(
    "An account with this email already exists. Sign in instead.",
  )

  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.locator(".auth__error")).toHaveCount(0)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill("definitely-the-wrong-password")
  await page.getByRole("button", { name: "Enter" }).click()
  await expect(page.locator(".auth__error")).toHaveText(
    "Email or password is incorrect. Check your details and try again.",
  )

  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Enter" }).click()
  await expect(page).toHaveURL(/\/today$/u)
})
