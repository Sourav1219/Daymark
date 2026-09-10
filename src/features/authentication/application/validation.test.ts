import { describe, expect, it } from "vitest"

import {
  loginSchema,
  passwordChangeSchema,
  passwordResetSchema,
  profileNameSchema,
  registrationSchema,
  safeRedirectPath,
} from "./validation"

describe("registration validation", () => {
  it("normalizes valid registration input", () => {
    const result = registrationSchema.parse({
      email: "  USER@Example.com ",
      name: "  Ada Lovelace  ",
      password: "correct-horse-battery-staple",
      privacyNoticeAcknowledged: "on",
      termsAccepted: "on",
    })

    expect(result).toEqual({
      email: "user@example.com",
      name: "Ada Lovelace",
      password: "correct-horse-battery-staple",
      privacyNoticeAcknowledged: "on",
      termsAccepted: "on",
    })
  })

  it("requires combined age and terms acceptance plus privacy acknowledgement", () => {
    const result = registrationSchema.safeParse({
      email: "user@example.com",
      name: "Valid Name",
      password: "correct-horse-battery-staple",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        privacyNoticeAcknowledged: expect.any(Array),
        termsAccepted: expect.any(Array),
      })
    }
  })

  it("rejects malformed email, short name, and short password", () => {
    const result = registrationSchema.safeParse({
      email: "not-an-email",
      name: "A",
      password: "too-short",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        email: expect.any(Array),
        name: expect.any(Array),
        password: expect.any(Array),
      })
    }
  })

  it("rejects trivial and common passwords", () => {
    expect(
      registrationSchema.safeParse({
        email: "user@example.com",
        name: "Valid Name",
        password: "123456789012",
      }).success,
    ).toBe(false)

    expect(
      registrationSchema.safeParse({
        email: "user@example.com",
        name: "Valid Name",
        password: "aaaaaaaaaaaa",
      }).success,
    ).toBe(false)
  })
})

describe("login validation", () => {
  it("accepts an existing credential shape and normalizes email", () => {
    expect(
      loginSchema.parse({ email: " ADA@EXAMPLE.COM ", password: "secret" }),
    ).toEqual({ email: "ada@example.com", password: "secret" })
  })

  it("rejects empty passwords", () => {
    expect(
      loginSchema.safeParse({ email: "ada@example.com", password: "" }).success,
    ).toBe(false)
  })
})

describe("password reset validation", () => {
  it("requires a plausible token and matching secure passwords", () => {
    expect(
      passwordResetSchema.safeParse({
        confirmPassword: "correct-horse-battery-staple",
        newPassword: "correct-horse-battery-staple",
        token: "one-time-reset-token-123456",
      }).success,
    ).toBe(true)
    expect(
      passwordResetSchema.safeParse({
        confirmPassword: "different-password",
        newPassword: "correct-horse-battery-staple",
        token: "short",
      }).success,
    ).toBe(false)
  })
})

describe("account settings validation", () => {
  it("normalizes a valid profile name", () => {
    expect(profileNameSchema.parse({ name: "  Ada Lovelace  " })).toEqual({
      name: "Ada Lovelace",
    })
  })

  it("requires matching, changed passwords", () => {
    expect(
      passwordChangeSchema.safeParse({
        confirmPassword: "different-password",
        currentPassword: "existing-password",
        newPassword: "new-secure-password",
      }).success,
    ).toBe(false)
    expect(
      passwordChangeSchema.safeParse({
        confirmPassword: "existing-password",
        currentPassword: "existing-password",
        newPassword: "existing-password",
      }).success,
    ).toBe(false)
  })
})

describe("redirect validation", () => {
  it("keeps local paths and rejects protocol-relative redirects", () => {
    expect(safeRedirectPath("/app/workspaces/example")).toBe(
      "/app/workspaces/example",
    )
    expect(safeRedirectPath("/app")).toBe("/today")
    expect(safeRedirectPath("/today")).toBe("/today")
    expect(safeRedirectPath("/profile")).toBe("/profile")
    expect(safeRedirectPath("//attacker.example/path")).toBe("/today")
    expect(safeRedirectPath("https://attacker.example/path")).toBe("/today")
    expect(safeRedirectPath("/today-attacker")).toBe("/today")
  })
})
