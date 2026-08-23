import { z } from "zod"

const r2Keys = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const

const optionalGoogleCredential = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().trim().min(8).optional(),
)

export const serverEnvSchema = z
  .object({
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    MIGRATION_DATABASE_URL: z
      .string()
      .url()
      .startsWith("postgresql://")
      .optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    GOOGLE_CLIENT_ID: optionalGoogleCredential,
    GOOGLE_CLIENT_SECRET: optionalGoogleCredential,
    // Shared cron secret. Required in production: Vercel Cron sends this and
    // only this value as the Bearer token for native scheduled jobs.
    CRON_SECRET: z.string().min(32).optional(),
    // Optional per-job secrets, accepted in addition to the shared secret for
    // schedulers that can set custom headers.
    CRON_SECRET_STALE_ROOMS: z.string().min(16).optional(),
    CRON_SECRET_STALE_TIMERS: z.string().min(16).optional(),
    CRON_SECRET_REMINDERS: z.string().min(16).optional(),
    CRON_SECRET_ATTACHMENTS: z.string().min(16).optional(),
    CRON_SECRET_OVERDUE: z.string().min(16).optional(),
    CRON_SECRET_RETENTION: z.string().min(16).optional(),
    // Enables the database readiness endpoint for trusted deployment probes.
    READINESS_SECRET: z.string().min(32).optional(),
    EMAIL_FROM: z.string().email().optional(),
    REMINDER_FROM_EMAIL: z.string().email().optional(),
    RESEND_API_KEY: z.string().startsWith("re_").optional(),
    VAPID_PRIVATE_KEY: z.string().min(32).optional(),
    VAPID_PUBLIC_KEY: z.string().min(32).optional(),
    VAPID_SUBJECT: z
      .string()
      .refine(
        (value) => value.startsWith("mailto:") || value.startsWith("https://"),
        "VAPID subject must use mailto: or https:.",
      )
      .optional(),
    R2_ACCOUNT_ID: z
      .string()
      .regex(/^[a-f\d]{32}$/iu)
      .optional(),
    R2_ACCESS_KEY_ID: z.string().min(16).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(32).optional(),
    R2_BUCKET_NAME: z
      .string()
      .regex(/^[a-z\d][a-z\d-]{1,61}[a-z\d]$/u)
      .optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Optional only outside production. Both values are required together.
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(16).optional(),
    // Set to true only when a trusted reverse proxy terminates and overwrites
    // x-forwarded-for / x-real-ip. Off by default so callers cannot rotate
    // spoofed forwarded headers to evade IP-scoped rate limits.
    TRUST_FORWARDED_IP_HEADERS: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim().length === 0
            ? undefined
            : value,
        z.stringbool(),
      )
      .optional(),
  })
  .superRefine((env, context) => {
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      context.addIssue({
        code: "custom",
        message:
          "Configure both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or neither.",
        path: ["GOOGLE_CLIENT_ID"],
      })
    }
    // In production, enforce HTTPS for the auth URL.
    if (
      env.NODE_ENV === "production" &&
      !env.BETTER_AUTH_URL.startsWith("https://")
    ) {
      context.addIssue({
        code: "custom",
        message: "BETTER_AUTH_URL must use https:// in production.",
        path: ["BETTER_AUTH_URL"],
      })
    }
    if (env.NODE_ENV === "production") {
      if (!env.CRON_SECRET) {
        context.addIssue({
          code: "custom",
          message:
            "CRON_SECRET is required in production because Vercel Cron sends it as the Bearer token.",
          path: ["CRON_SECRET"],
        })
      }
      if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
        context.addIssue({
          code: "custom",
          message:
            "Distributed rate limiting credentials are required in production.",
          path: ["UPSTASH_REDIS_REST_URL"],
        })
      }
      const runtimeUrl = new URL(env.DATABASE_URL)
      const migrationUrl = env.MIGRATION_DATABASE_URL
        ? new URL(env.MIGRATION_DATABASE_URL)
        : null
      const encryptedModes = new Set(["require", "verify-ca", "verify-full"])
      const hasTlsMode = (url: URL) =>
        encryptedModes.has(url.searchParams.get("sslmode")?.toLowerCase() ?? "")

      if (!hasTlsMode(runtimeUrl)) {
        context.addIssue({
          code: "custom",
          message:
            "DATABASE_URL must set sslmode=require or a stricter mode in production.",
          path: ["DATABASE_URL"],
        })
      }
      if (!migrationUrl) {
        context.addIssue({
          code: "custom",
          message:
            "MIGRATION_DATABASE_URL is required for the separate migration role in production.",
          path: ["MIGRATION_DATABASE_URL"],
        })
      } else {
        if (!hasTlsMode(migrationUrl)) {
          context.addIssue({
            code: "custom",
            message:
              "MIGRATION_DATABASE_URL must set sslmode=require or a stricter mode in production.",
            path: ["MIGRATION_DATABASE_URL"],
          })
        }
        if (runtimeUrl.username === migrationUrl.username) {
          context.addIssue({
            code: "custom",
            message:
              "Runtime and migration database URLs must use different roles in production.",
            path: ["MIGRATION_DATABASE_URL"],
          })
        }
      }
    }
    if (
      Boolean(env.UPSTASH_REDIS_REST_URL) !==
      Boolean(env.UPSTASH_REDIS_REST_TOKEN)
    ) {
      context.addIssue({
        code: "custom",
        message: "Configure both Upstash Redis credentials or neither.",
        path: ["UPSTASH_REDIS_REST_URL"],
      })
    }
    const configured = r2Keys.filter((key) => Boolean(env[key]))
    if (configured.length !== 0 && configured.length !== r2Keys.length) {
      context.addIssue({
        code: "custom",
        message: "Configure all Cloudflare R2 credentials or none of them.",
        path: ["R2_ACCOUNT_ID"],
      })
    }
    const vapid = [
      env.VAPID_PRIVATE_KEY,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_SUBJECT,
    ].filter(Boolean)
    if (vapid.length !== 0 && vapid.length !== 3) {
      context.addIssue({
        code: "custom",
        message: "Configure all VAPID values or none of them.",
        path: ["VAPID_PUBLIC_KEY"],
      })
    }
    // EMAIL_FROM is the shared transactional sender. The reminder-specific
    // value remains a backwards-compatible fallback for existing deployments.
    const emailFrom = env.EMAIL_FROM ?? env.REMINDER_FROM_EMAIL
    const emailDelivery = [Boolean(env.RESEND_API_KEY), Boolean(emailFrom)]
    if (emailDelivery.some(Boolean) && !emailDelivery.every(Boolean)) {
      context.addIssue({
        code: "custom",
        message:
          "Configure RESEND_API_KEY with EMAIL_FROM to enable transactional email, or neither.",
        path: ["RESEND_API_KEY"],
      })
    }
    if (env.NODE_ENV === "production" && (!env.RESEND_API_KEY || !emailFrom)) {
      context.addIssue({
        code: "custom",
        message:
          "RESEND_API_KEY and EMAIL_FROM are required in production for account verification and password recovery.",
        path: ["EMAIL_FROM"],
      })
    }
  })

export type ServerEnv = z.infer<typeof serverEnvSchema>

export type GoogleAuthEnv = Readonly<{
  clientId: string
  clientSecret: string
}>

export function emailFromServerEnv(env: ServerEnv): string | undefined {
  return env.EMAIL_FROM ?? env.REMINDER_FROM_EMAIL
}

export function googleAuthEnvFromServerEnv(
  env: ServerEnv,
): GoogleAuthEnv | null {
  return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }
    : null
}

export type R2Env = Readonly<{
  accountId: string
  accessKeyId: string
  bucketName: string
  secretAccessKey: string
}>

export function r2EnvFromServerEnv(env: ServerEnv): R2Env | null {
  return env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME
    ? {
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        bucketName: env.R2_BUCKET_NAME,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      }
    : null
}
