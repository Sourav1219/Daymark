// @vitest-environment node

import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createDatabase, type Database } from "@/db/client"
import {
  accounts,
  gates,
  labels,
  questLabels,
  rateLimits,
  sessions,
  tasks,
  userProgression,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema"
import { createAuth, type Auth } from "@/features/authentication/server/auth"
import type { AuthenticationEmailDelivery } from "@/features/authentication/server/authentication-email-delivery"
import { provisionPersonalWorkspace } from "@/features/workspaces/application/provision-personal-workspace"
import {
  findPersonalWorkspaceAccess,
  findWorkspaceAccess,
  getWorkspaceSummary,
} from "@/features/workspaces/infrastructure/workspace-access-repository"
import type { ServerEnv } from "@/lib/env/schema"
import { clearReminderFixtures } from "@/test/clear-reminder-fixtures"

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const integrationDescribe = testDatabaseUrl
  ? describe.sequential
  : describe.skip

integrationDescribe("authentication and workspace integration", () => {
  let auth: Auth
  let database: Database
  const passwordResetUrls: string[] = []
  const verificationCodes: string[] = []

  beforeAll(() => {
    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    }

    database = createDatabase(testDatabaseUrl)
    const env: ServerEnv = {
      BETTER_AUTH_SECRET: "integration-test-secret-at-least-32-characters",
      BETTER_AUTH_URL: "https://questly.test",
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: "production",
    }
    const emailDelivery: AuthenticationEmailDelivery = {
      sendPasswordReset: async (input) => {
        passwordResetUrls.push(input.url)
      },
      sendVerificationCode: async (input) => {
        verificationCodes.push(input.code)
      },
    }
    auth = createAuth(database, env, emailDelivery)
  })

  beforeEach(async () => {
    await clearReminderFixtures(database)
    await database.delete(rateLimits)
    await database.delete(questLabels)
    await database.delete(tasks)
    await database.delete(labels)
    await database.delete(gates)
    await database.delete(workspaces)
    await database.delete(users)
    passwordResetUrls.length = 0
    verificationCodes.length = 0
  })

  afterAll(async () => {
    if (database) {
      await database.$client.end({ timeout: 2 })
    }
  })

  it("requires email verification and creates a session after a valid OTP", async () => {
    const registration = await auth.api.signUpEmail({
      body: {
        email: "ada@example.com",
        name: "Ada Lovelace",
        password: "correct-horse-battery-staple",
      },
      headers: new Headers({ origin: "https://questly.test" }),
      returnHeaders: true,
    })
    const setCookie = registration.headers.get("set-cookie") ?? ""

    expect(setCookie).not.toContain("session_token")
    expect(verificationCodes).toHaveLength(1)

    const access = await findPersonalWorkspaceAccess(
      database,
      registration.response.user.id,
    )
    expect(access).toMatchObject({
      role: "owner",
      userId: registration.response.user.id,
    })

    const workspace = access
      ? await getWorkspaceSummary(database, access)
      : null
    expect(workspace).toMatchObject({
      name: "Ada's Workspace",
      timezone: "UTC",
    })

    await expect(
      auth.api.signInEmail({
        body: {
          email: "ada@example.com",
          password: "correct-horse-battery-staple",
        },
        headers: new Headers({ origin: "https://questly.test" }),
      }),
    ).rejects.toMatchObject({ statusCode: 403 })

    const verification = await auth.api.verifyEmailOTP({
      body: {
        email: "ada@example.com",
        otp: verificationCodes[0] ?? "",
      },
      headers: new Headers({ origin: "https://questly.test" }),
      returnHeaders: true,
    })
    expect(verification.response.token).toBeTruthy()
    expect(verification.headers.get("set-cookie")).toContain(
      "__Secure-questly.session_token=",
    )
    expect(verification.headers.get("set-cookie")).toMatch(/HttpOnly/i)
    expect(verification.headers.get("set-cookie")).toMatch(/Secure/i)
    expect(verification.headers.get("set-cookie")).toMatch(/SameSite=Lax/i)

    await auth.api.requestPasswordReset({
      body: { email: "ada@example.com", redirectTo: "/reset-password" },
      headers: new Headers({ origin: "https://questly.test" }),
    })
    expect(passwordResetUrls).toHaveLength(1)
    const resetToken = new URL(passwordResetUrls[0] ?? "").searchParams.get(
      "token",
    )
    expect(resetToken).toBeTruthy()
    await auth.api.resetPassword({
      body: {
        newPassword: "a-different-secure-password",
        token: resetToken ?? "",
      },
      headers: new Headers({ origin: "https://questly.test" }),
    })
    await expect(database.select().from(sessions)).resolves.toHaveLength(0)
    await expect(
      auth.api.resetPassword({
        body: {
          newPassword: "another-secure-password",
          token: resetToken ?? "",
        },
        headers: new Headers({ origin: "https://questly.test" }),
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it("keeps personal workspace provisioning idempotent", async () => {
    const userId = randomUUID()
    await database.insert(users).values({
      email: "grace@example.com",
      id: userId,
      name: "Grace Hopper",
    })

    const firstId = await provisionPersonalWorkspace(database, {
      id: userId,
      name: "Grace Hopper",
    })
    const secondId = await provisionPersonalWorkspace(database, {
      id: userId,
      name: "Grace Hopper",
    })

    expect(secondId).toBe(firstId)
    expect(
      await database
        .select()
        .from(workspaces)
        .where(eq(workspaces.ownerUserId, userId)),
    ).toHaveLength(1)
    expect(
      await database
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, userId)),
    ).toHaveLength(1)
    expect(
      await database
        .select()
        .from(userProgression)
        .where(eq(userProgression.userId, userId)),
    ).toHaveLength(1)
  })

  it("allows membership and denies cross-workspace access", async () => {
    const firstUserId = randomUUID()
    const secondUserId = randomUUID()
    await database.insert(users).values([
      { email: "first@example.com", id: firstUserId, name: "First User" },
      { email: "second@example.com", id: secondUserId, name: "Second User" },
    ])
    const firstWorkspaceId = await provisionPersonalWorkspace(database, {
      id: firstUserId,
      name: "First User",
    })
    const secondWorkspaceId = await provisionPersonalWorkspace(database, {
      id: secondUserId,
      name: "Second User",
    })

    await expect(
      findWorkspaceAccess(database, {
        userId: firstUserId,
        workspaceId: firstWorkspaceId,
      }),
    ).resolves.toMatchObject({ role: "owner" })
    await expect(
      findWorkspaceAccess(database, {
        userId: firstUserId,
        workspaceId: secondWorkspaceId,
      }),
    ).resolves.toBeNull()
  })

  it("uses database-backed credential and session records", async () => {
    await auth.api.signUpEmail({
      body: {
        email: "records@example.com",
        name: "Records User",
        password: "correct-horse-battery-staple",
      },
      headers: new Headers({ origin: "https://questly.test" }),
    })

    await expect(database.select().from(accounts)).resolves.toHaveLength(1)
    await expect(database.select().from(sessions)).resolves.toHaveLength(0)
  })

  it("persists production authentication rate-limit buckets", async () => {
    const response = await auth.handler(
      new Request("https://questly.test/api/auth/sign-in/email", {
        body: JSON.stringify({
          email: "missing@example.com",
          password: "incorrect-password",
        }),
        headers: {
          "content-type": "application/json",
          origin: "https://questly.test",
        },
        method: "POST",
      }),
    )

    expect(response.status).toBe(401)
    await expect(database.select().from(rateLimits)).resolves.toMatchObject([
      { count: 1 },
    ])
  })
})
