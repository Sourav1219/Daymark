import type { Route } from "next"
import { z } from "zod"

const minimumRegistrationPasswordLength =
  process.env.NODE_ENV === "development" ? 8 : 12

const email = z
  .string()
  .trim()
  .pipe(
    z
      .email("Enter a valid email address")
      .max(320, "Email address is too long"),
  )
  .transform((value) => value.trim().toLowerCase())

export const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be 120 characters or fewer"),
  email,
  password: z
    .string()
    .min(
      minimumRegistrationPasswordLength,
      `Password must be at least ${minimumRegistrationPasswordLength} characters`,
    )
    .max(128, "Password must be 128 characters or fewer"),
})

export const loginSchema = z.object({
  email,
  password: z
    .string()
    .min(1, "Enter your password")
    .max(128, "Password must be 128 characters or fewer"),
})

export const emailRequestSchema = z.object({ email })

export const emailVerificationCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/u, "Enter the 6-digit code from your email"),
  email,
})

export const passwordResetTokenSchema = z
  .string()
  .min(20, "This password reset link is invalid or expired")
  .max(2_048, "This password reset link is invalid or expired")

export const passwordResetSchema = z
  .object({
    confirmPassword: z.string(),
    newPassword: registrationSchema.shape.password,
    token: passwordResetTokenSchema,
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export const profileNameSchema = z.object({
  name: registrationSchema.shape.name,
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Enter your current password")
      .max(128, "Password must be 128 characters or fewer"),
    newPassword: registrationSchema.shape.password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Choose a password different from your current password",
    path: ["newPassword"],
  })

const protectedRedirectRoots = [
  "/app",
  "/today",
  "/quests",
  "/timer",
  "/gates",
  "/labels",
  "/cleared",
  "/progress",
  "/profile",
  "/settings",
] as const

export function safeRedirectPath(value: FormDataEntryValue | null): Route {
  if (value === "/app") {
    return "/today"
  }

  if (
    typeof value !== "string" ||
    !protectedRedirectRoots.some(
      (root) =>
        value === root ||
        value.startsWith(`${root}/`) ||
        value.startsWith(`${root}?`),
    )
  ) {
    return "/today"
  }

  return value as Route
}
