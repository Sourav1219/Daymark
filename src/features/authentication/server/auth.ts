import "server-only"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { captcha, emailOTP } from "better-auth/plugins"

import type { Database } from "@/db/client"
import { getDatabase, withHealthyDatabase } from "@/db/client"
import * as schema from "@/db/schema"
import { AUTH_COOKIE_PREFIX } from "@/features/authentication/config"
import { registrationAcceptanceCookieName } from "@/features/authentication/domain/registration-acceptance"
import {
  createAuthenticationEmailDelivery,
  deliverAuthenticationEmail,
  type AuthenticationEmailDelivery,
} from "@/features/authentication/server/authentication-email-delivery"
import {
  readRegistrationAcceptance,
  registrationAcceptanceUserFields,
} from "@/features/authentication/server/registration-acceptance"
import { provisionPersonalWorkspace } from "@/features/workspaces/application/provision-personal-workspace"
import { readServerEnv } from "@/lib/env/server"
import {
  googleAuthEnvFromServerEnv,
  isLoopbackE2ETestEnvironment,
  type ServerEnv,
} from "@/lib/env/schema"
import {
  publishRealtimeEvent,
  userSessionRealtimeChannel,
} from "@/lib/realtime/realtime-events"

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
  const e2eTestMode = isLoopbackE2ETestEnvironment(env)
  const e2eVerificationCode = e2eTestMode ? "481516" : null
  const turnstileSecret = e2eTestMode ? undefined : env.TURNSTILE_SECRET_KEY

  const authentication = betterAuth({
    appName: "Traketo",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    user: {
      additionalFields: {
        ageConfirmedAt: {
          input: false,
          required: false,
          returned: false,
          type: "date",
        },
        ageRequirementVersion: {
          input: false,
          required: false,
          returned: false,
          type: "string",
        },
        privacyNoticeAcknowledgedAt: {
          input: false,
          required: false,
          returned: false,
          type: "date",
        },
        privacyNoticeVersion: {
          input: false,
          required: false,
          returned: false,
          type: "string",
        },
        termsAcceptedAt: {
          input: false,
          required: false,
          returned: false,
          type: "date",
        },
        termsVersion: {
          input: false,
          required: false,
          returned: false,
          type: "string",
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            await publishRealtimeEvent(
              userSessionRealtimeChannel(session.userId),
              { kind: "created", sessionId: session.id },
            )
          },
        },
        delete: {
          after: async (session) => {
            await publishRealtimeEvent(
              userSessionRealtimeChannel(session.userId),
              { kind: "deleted", sessionId: session.id },
            )
          },
        },
      },
      user: {
        create: {
          before: async (user, context) => {
            const source =
              context?.path === "/sign-up/email"
                ? "email"
                : context?.path?.startsWith("/callback/")
                  ? "google"
                  : null
            if (!source) return

            const acceptance = readRegistrationAcceptance(
              context?.headers,
              env.BETTER_AUTH_SECRET,
              source,
            )
            if (!acceptance) return false

            return {
              data: {
                ...user,
                ...registrationAcceptanceUserFields(acceptance),
              },
            }
          },
          after: async (user, context) => {
            await provisionPersonalWorkspace(database, user)
            if (context?.path?.startsWith("/callback/")) {
              context.setCookie(registrationAcceptanceCookieName, "", {
                httpOnly: true,
                maxAge: 0,
                path: "/",
                sameSite: "lax",
                secure: secureCookies,
              })
            }
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
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ token, user }) => {
        await deliverAuthenticationEmail(() =>
          emailDelivery.sendPasswordReset({
            recipientEmail: user.email,
            recipientName: user.name,
            url: passwordResetUrl(env, token),
          }),
        )
      },
    },
    emailVerification: {
      // OTP verification is the final proof of account ownership. Create the
      // session here so a newly verified user can enter the app immediately.
      autoSignInAfterVerification: true,
      sendOnSignIn: true,
      sendOnSignUp: true,
    },
    account: {
      // Provider credentials grant access outside Traketo. Better Auth can
      // transparently read legacy plaintext values while encrypting every new
      // or refreshed OAuth token with AES-256-GCM.
      encryptOAuthTokens: true,
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
    // Authentication entry points are protected by the shared Upstash limiter.
    // Keeping Better Auth's duplicate database limiter disabled avoids an
    // additional rate_limits query on every request through Supavisor.
    rateLimit: { enabled: false },
    session: {
      // Signed short-lived session data avoids repeating the same database
      // lookup across closely spaced RSC renders. Better Auth bypasses this
      // cache for its sensitive account operations; Traketo's explicit session
      // ping also performs an authoritative read for revocation detection.
      cookieCache: { enabled: true, maxAge: 60 },
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      "traketo://auth/callback",
      "daymark://auth/callback",
      "capacitor://localhost",
    ],
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
    plugins: [
      ...(turnstileSecret
        ? [
            captcha({
              expectedAction: "authentication",
              provider: "cloudflare-turnstile",
              secretKey: turnstileSecret,
            }),
          ]
        : []),
      emailOTP({
        allowedAttempts: 5,
        changeEmail: { enabled: true },
        expiresIn: 10 * 60,
        ...(e2eVerificationCode
          ? { generateOTP: () => e2eVerificationCode }
          : {}),
        otpLength: 6,
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "email-verification" && type !== "change-email") return
          await deliverAuthenticationEmail(() =>
            emailDelivery.sendVerificationCode({
              code: otp,
              purpose: type,
              recipientEmail: email,
            }),
          )
        },
        storeOTP: "hashed",
      }),
      nextCookies(),
    ],
  })

  return authentication
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

export function withHealthyAuth<T>(
  scope: (auth: Auth, database: Database) => Promise<T>,
) {
  const env = readServerEnv()
  return withHealthyDatabase((database) =>
    scope(createAuth(database, env), database),
  )
}
