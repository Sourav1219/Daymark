import { describe, expect, it } from "vitest"

import { serverEnvSchema } from "./schema"

describe("serverEnvSchema", () => {
  it("accepts the required server configuration", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://user:pass@example.test/questly",
      BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "https://agenda.example.test",
      NODE_ENV: "test",
    })

    expect(result.success).toBe(true)
  })

  it("rejects unsafe or incomplete values", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "not-a-postgres-url",
      BETTER_AUTH_SECRET: "short",
      BETTER_AUTH_URL: "not-a-url",
    })

    expect(result.success).toBe(false)
  })

  it("accepts Google OAuth credentials only as a complete pair", () => {
    const base = {
      DATABASE_URL: "postgresql://user:pass@example.test/questly",
      BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "https://agenda.example.test",
    }

    expect(
      serverEnvSchema.safeParse({
        ...base,
        GOOGLE_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
      }).success,
    ).toBe(true)
    expect(
      serverEnvSchema.safeParse({
        ...base,
        GOOGLE_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
      }).success,
    ).toBe(false)
    expect(
      serverEnvSchema.safeParse({
        ...base,
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
      }).success,
    ).toBe(true)
  })

  it("accepts a complete R2 group and rejects partial permanent credentials", () => {
    const base = {
      DATABASE_URL: "postgresql://user:pass@example.test/questly",
      BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "https://agenda.example.test",
    }
    expect(
      serverEnvSchema.safeParse({
        ...base,
        R2_ACCESS_KEY_ID: "access-key-at-least-16",
        R2_ACCOUNT_ID: "1234567890abcdef1234567890abcdef",
        R2_BUCKET_NAME: "questly-attachments",
        R2_SECRET_ACCESS_KEY: "secret-key-that-is-at-least-32-characters",
      }).success,
    ).toBe(true)
    expect(
      serverEnvSchema.safeParse({
        ...base,
        R2_SECRET_ACCESS_KEY: "secret-key-that-is-at-least-32-characters",
      }).success,
    ).toBe(false)
  })

  it("requires cron authentication configuration in production", () => {
    const production = {
      DATABASE_URL:
        "postgresql://app_user:pass@example.test/questly?sslmode=require",
      MIGRATION_DATABASE_URL:
        "postgresql://migration_user:pass@example.test/questly?sslmode=require",
      BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "https://agenda.example.test",
      NODE_ENV: "production" as const,
    }

    expect(serverEnvSchema.safeParse(production).success).toBe(false)
    expect(
      serverEnvSchema.safeParse({
        ...production,
        CRON_SECRET: "cron-secret-that-is-at-least-32-characters",
        EMAIL_FROM: "auth@example.test",
        RESEND_API_KEY: "re_production-test-key",
        UPSTASH_REDIS_REST_TOKEN: "redis-token-at-least-16",
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      }).success,
    ).toBe(true)
    expect(
      serverEnvSchema.safeParse({
        ...production,
        CRON_SECRET_ATTACHMENTS: "attachment-secret-that-is-at-least-16",
        CRON_SECRET_OVERDUE: "overdue-secret-that-is-at-least-16-characters",
        CRON_SECRET_REMINDERS: "reminder-secret-that-is-at-least-16-characters",
        CRON_SECRET_STALE_ROOMS:
          "stale-rooms-secret-that-is-at-least-16-characters",
        CRON_SECRET_STALE_TIMERS:
          "stale-timers-secret-that-is-at-least-16-characters",
        UPSTASH_REDIS_REST_TOKEN: "redis-token-at-least-16",
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      }).success,
    ).toBe(false)
  })

  it("requires complete Redis credentials and requires them in production", () => {
    const base = {
      DATABASE_URL: "postgresql://user:pass@example.test/questly",
      BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "https://agenda.example.test",
    }

    expect(
      serverEnvSchema.safeParse({
        ...base,
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      }).success,
    ).toBe(false)
    expect(
      serverEnvSchema.safeParse({
        ...base,
        CRON_SECRET: "cron-secret-that-is-at-least-32-characters",
        NODE_ENV: "production",
      }).success,
    ).toBe(false)
  })

  it("requires transactional email delivery in production", () => {
    const production = {
      BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "https://agenda.example.test",
      CRON_SECRET: "cron-secret-that-is-at-least-32-characters",
      DATABASE_URL:
        "postgresql://app_user:pass@example.test/questly?sslmode=require",
      MIGRATION_DATABASE_URL:
        "postgresql://migration_user:pass@example.test/questly?sslmode=require",
      NODE_ENV: "production" as const,
      UPSTASH_REDIS_REST_TOKEN: "redis-token-at-least-16",
      UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    }

    expect(serverEnvSchema.safeParse(production).success).toBe(false)
    expect(
      serverEnvSchema.safeParse({
        ...production,
        EMAIL_FROM: "auth@example.test",
        RESEND_API_KEY: "re_production-test-key",
      }).success,
    ).toBe(true)
  })

  it("requires encrypted, role-separated database URLs in production", () => {
    const production = {
      BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "https://agenda.example.test",
      CRON_SECRET: "cron-secret-that-is-at-least-32-characters",
      EMAIL_FROM: "auth@example.test",
      NODE_ENV: "production" as const,
      RESEND_API_KEY: "re_production-test-key",
      UPSTASH_REDIS_REST_TOKEN: "redis-token-at-least-16",
      UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    }

    expect(
      serverEnvSchema.safeParse({
        ...production,
        DATABASE_URL: "postgresql://app_user:pass@example.test/questly",
        MIGRATION_DATABASE_URL:
          "postgresql://migration_user:pass@example.test/questly?sslmode=require",
      }).success,
    ).toBe(false)
    expect(
      serverEnvSchema.safeParse({
        ...production,
        DATABASE_URL:
          "postgresql://shared_user:pass@example.test/questly?sslmode=require",
        MIGRATION_DATABASE_URL:
          "postgresql://shared_user:other@example.test/questly?sslmode=verify-full",
      }).success,
    ).toBe(false)
    expect(
      serverEnvSchema.safeParse({
        ...production,
        DATABASE_URL:
          "postgresql://app_user:pass@example.test/questly?sslmode=require",
        MIGRATION_DATABASE_URL:
          "postgresql://migration_user:pass@example.test/questly?sslmode=verify-full",
      }).success,
    ).toBe(true)
  })
})
