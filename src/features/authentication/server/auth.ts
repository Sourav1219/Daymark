import "server-only"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { createEmailVerificationToken } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"

import type { Database } from "@/db/client"
import { getDatabase, withHealthyDatabase } from "@/db/client"
import * as schema from "@/db/schema"
import { AUTH_COOKIE_PREFIX } from "@/features/authentication/config"
import {
  createAuthenticationEmailDelivery,
  type AuthenticationEmailDelivery,
  scheduleAuthenticationEmail,
} from "@/features/authentication/server/authentication-email-delivery"
import { provisionPersonalWorkspace } from "@/features/workspaces/application/provision-personal-workspace"
import { readServerEnv } from "@/lib/env/server"
import { googleAuthEnvFromServerEnv, type ServerEnv } from "@/lib/env/schema"

function verificationUrl(env: ServerEnv, token: string): string {
  const callbackUrl = new URL("/sign-in", env.BETTER_AUTH_URL)
  callbackUrl.searchParams.set("verified", "1")
  const url = new URL("/api/auth/verify-email", env.BETTER_AUTH_URL)
  url.searchParams.set("token", token)
  url.searchParams.set("callbackURL", callbackUrl.toString())
  return url.toString()
}

function passwordResetUrl(env: ServerEnv, token: string): string {
  const url = new URL("/reset-password", env.BETTER_AUTH_URL)
  url.searchParams.set("token", token)
  return url.toString()
}

export function createAuth(
  database: Database,
  env: ServerEnv,
  emailDelivery: AuthenticationEmailDelivery = createAuthenticationEmailDelivery(
    env,
  ),
) {
  const secureCookies = env.NODE_ENV === "production"
  const minPasswordLength = env.NODE_ENV === "development" ? 8 : 12
  const googleAuth = googleAuthEnvFromServerEnv(env)

  return betterAuth({
    appName: "Daymark",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await provisionPersonalWorkspace(database, user)
          },
        },
      },
    },
    emailAndPassword: {
      // Registration returns the same generic response for new and existing
      // addresses, so it must not expose success by creating a session.
      autoSignIn: false,
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength,
      onExistingUserSignUp: async ({ user }) => {
        if (user.emailVerified) return
        const token = await createEmailVerificationToken(
          env.BETTER_AUTH_SECRET,
          user.email,
          undefined,
          60 * 60,
        )
        await scheduleAuthenticationEmail(() =>
          emailDelivery.sendVerification({
            recipientEmail: user.email,
            recipientName: user.name,
            url: verificationUrl(env, token),
          }),
        )
      },
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ token, user }) => {
        await scheduleAuthenticationEmail(() =>
          emailDelivery.sendPasswordReset({
            recipientEmail: user.email,
            recipientName: user.name,
            url: passwordResetUrl(env, token),
          }),
        )
      },
    },
    emailVerification: {
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendOnSignIn: true,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await scheduleAuthenticationEmail(() =>
          emailDelivery.sendVerification({
            recipientEmail: user.email,
            recipientName: user.name,
            url,
          }),
        )
      },
    },
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        enabled: true,
        requireLocalEmailVerified: true,
      },
    },
    ...(googleAuth
      ? {
          socialProviders: {
            google: {
              clientId: googleAuth.clientId,
              clientSecret: googleAuth.clientSecret,
              disableImplicitSignUp: true,
              prompt: "select_account" as const,
            },
          },
        }
      : {}),
    rateLimit: {
      customRules: {
        "/sign-in/email": { max: 10, window: 60 },
        "/sign-up/email": { max: 5, window: 60 },
        "/request-password-reset": { max: 5, window: 60 },
        "/reset-password": { max: 5, window: 60 },
        "/send-verification-email": { max: 5, window: 60 },
      },
      // Brute-force protection is not production-only: the database storage
      // works locally, so development keeps it too. Only automated tests run
      // unrestricted so integration suites can exercise auth freely.
      enabled: env.NODE_ENV !== "test",
      storage: "database",
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      database: { generateId: "uuid" },
      defaultCookieAttributes: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: secureCookies,
      },
      useSecureCookies: secureCookies,
    },
    // Keep this plugin last so auth API calls made by Server Actions can set
    // the response cookie through Next.js.
    plugins: [nextCookies()],
  })
}

export type Auth = ReturnType<typeof createAuth>

let auth: Auth | undefined
let authDatabase: Database | undefined

export function getAuth(): Auth {
  const database = getDatabase()
  if (!auth || authDatabase !== database) {
    auth = createAuth(database, readServerEnv())
    authDatabase = database
  }

  return auth
}

export function withHealthyAuth<T>(scope: (auth: Auth) => Promise<T>) {
  const env = readServerEnv()
  return withHealthyDatabase((database) => scope(createAuth(database, env)))
}
