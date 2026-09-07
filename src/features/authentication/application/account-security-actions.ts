"use server"

import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"

import { getDatabase } from "@/db/client"
import {
  requireUser,
  requireWorkspaceAccess,
} from "@/features/authentication/server/authorization"
import { deleteUserAndOwnedData } from "@/features/authentication/mutations/account-deletion-service"
import { buildAccountExport } from "@/features/authentication/export/account-export-service"
import { buildAccountExportPdf } from "@/features/authentication/export/account-export-pdf"
import {
  listActiveSessionRecords,
  revokeAllSessionRecords,
  revokeSessionRecord,
} from "@/features/authentication/repositories/session-management-repository"
import {
  bypassTwoFactorPasswordStorage,
  getAuth,
  preserveActiveSessionStorage,
} from "@/features/authentication/server/auth"
import type { ActionResult } from "@/lib/actions/action-result"
import { validationFailure } from "@/lib/actions/action-helpers"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"
import { and, eq, isNotNull } from "drizzle-orm"
import { accounts } from "@/db/schema"
import { logSecurityEvent } from "@/lib/observability/logger"
import { z } from "zod"
import {
  publishRealtimeEvent,
  userSessionRealtimeChannel,
} from "@/lib/realtime/realtime-events"
import { isAPIError } from "better-auth/api"
import QRCode from "qrcode"
import { confirmTwoFactorSchema } from "@/features/authentication/application/validation"

export type SessionView = Readonly<{
  createdAt: string
  expiresAt: string
  id: string
  ipAddress: string | null
  userAgent: string | null
}>

export type ExportDataState = ActionResult<{
  filename: string
  pdfBase64: string
}> | null
export type DeleteAccountState = ActionResult<{ deleted: true }> | null

export type EnableTwoFactorState = ActionResult<{
  qrCodeDataUrl: string
  secretKey: string
  totpURI: string
}> | null

export type ConfirmTwoFactorState = ActionResult<{
  enabled: true
}> | null

export type DisableTwoFactorState = ActionResult<{
  disabled: true
}> | null

const revokeSessionSchema = z.object({ sessionId: z.uuid() })
const deleteAccountPasswordSchema = z.object({
  password: z.string().min(1).max(128),
})
const deleteAccountConfirmationSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((val) => val.toUpperCase() === "DELETE", {
      message: 'Type "DELETE" to confirm account deletion.',
    }),
})

async function accountRateLimitFailure(userId: string) {
  const limit = await enforceRateLimit({
    headers: await headers(),
    policy: "account",
    userId,
  })
  return limit && !limit.success
    ? ({
        error: {
          code: "RATE_LIMITED",
          message: "Too many account requests. Please wait and try again.",
        },
        ok: false,
      } as const)
    : null
}

export async function listActiveSessionsAction(): Promise<
  ActionResult<readonly SessionView[]>
> {
  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  const records = await listActiveSessionRecords(
    getDatabase(),
    user.id,
    new Date(),
  )

  return {
    data: records.map((record) => ({
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      id: record.id,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
    })),
    ok: true,
  }
}

export async function revokeSessionAction(input: {
  sessionId: string
}): Promise<ActionResult<{ revoked: boolean }>> {
  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  const parsed = revokeSessionSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure("That session could not be identified.", {})
  }

  const revoked = await revokeSessionRecord(getDatabase(), {
    sessionId: parsed.data.sessionId,
    userId: user.id,
  })
  if (revoked) {
    logSecurityEvent("session.revoked", {
      sessionId: parsed.data.sessionId,
      userId: user.id,
    })
    await publishRealtimeEvent(userSessionRealtimeChannel(user.id), {
      kind: "revoked",
      sessionId: parsed.data.sessionId,
    })
  }
  revalidatePath("/profile")

  return { data: { revoked }, ok: true }
}

/**
 * Revokes every session across all devices. The current cookie is cleared by
 * the Better Auth sign-out call afterwards.
 */
export async function signOutEverywhereAction(): Promise<
  ActionResult<{ signedOut: true }>
> {
  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  await revokeAllSessionRecords(getDatabase(), user.id)
  logSecurityEvent("session.revoked_all", { userId: user.id })
  await getAuth().api.signOut({ headers: await headers() })
  await publishRealtimeEvent(userSessionRealtimeChannel(user.id), {
    kind: "revoked-all",
  })

  return { data: { signedOut: true }, ok: true }
}

export async function exportAccountDataAction(): Promise<ExportDataState> {
  const access = await requireWorkspaceAccess()
  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  const payload = await buildAccountExport(getDatabase(), access, {
    email: user.email,
    name: user.name,
  })
  const pdf = await buildAccountExportPdf(payload)

  return {
    data: {
      filename: `traketo-export-${new Date().toISOString().slice(0, 10)}.pdf`,
      pdfBase64: Buffer.from(pdf).toString("base64"),
    },
    ok: true,
  }
}

export async function deleteAccountAction(
  _previousState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  const database = getDatabase()
  const [credentialAccount] = await database
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), isNotNull(accounts.password)))
    .limit(1)

  const hasPassword = Boolean(credentialAccount)

  if (hasPassword) {
    const parsed = deleteAccountPasswordSchema.safeParse({
      password: formData.get("password"),
    })
    if (!parsed.success) {
      return validationFailure(
        "Enter your password to confirm account deletion.",
        { password: ["Your password is required."] },
      )
    }

    // The password check runs against the live auth provider before any purge;
    // a failed verification leaves every record untouched.
    const verification = await getAuth()
      .api.verifyPassword({
        body: { password: parsed.data.password },
        headers: await headers(),
      })
      .catch(() => null)

    if (!verification?.status) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          fieldErrors: { password: ["That password is not correct."] },
          message: "Review the deletion confirmation and try again.",
        },
        ok: false,
      }
    }
  } else {
    const parsed = deleteAccountConfirmationSchema.safeParse({
      confirmation: formData.get("confirmation"),
    })
    if (!parsed.success) {
      return validationFailure('Type "DELETE" to confirm account deletion.', {
        confirmation: ['Type "DELETE" exactly to confirm.'],
      })
    }
  }

  const summary = await deleteUserAndOwnedData(database, user.id)
  logSecurityEvent("account.deleted", { userId: user.id })

  if (summary.attachmentKeys.length > 0) {
    await removeAttachmentObjects(summary.attachmentKeys)
  }

  await getAuth().api.signOut({ headers: await headers() })
  revalidatePath("/profile")

  return { data: { deleted: true }, ok: true }
}

/**
 * Best-effort private storage cleanup after the database commit. Object
 * deletion failures must not block the account deletion itself; the retention
 * sweep and R2 lifecycle rules remain the backstop.
 */
async function removeAttachmentObjects(storageKeys: readonly string[]) {
  const { r2EnvFromServerEnv } = await import("@/lib/env/schema")
  const { readServerEnv } = await import("@/lib/env/server")
  const { createR2AttachmentStorage } =
    await import("@/features/attachments/storage/r2-attachment-storage")

  const env = readServerEnv()
  const r2 = r2EnvFromServerEnv(env)
  if (!r2) return

  const storage = createR2AttachmentStorage(r2)
  const batchSize = 20
  for (let i = 0; i < storageKeys.length; i += batchSize) {
    const chunk = storageKeys.slice(i, i + batchSize)
    await Promise.allSettled(
      chunk.map((key) =>
        storage.deleteObject(key).catch(() => {
          // Leftover objects are inert without their database rows.
        }),
      ),
    )
  }
}

export async function enableTwoFactorAction(
  _previousState: EnableTwoFactorState,
  _formData?: FormData,
): Promise<EnableTwoFactorState> {
  void _previousState
  void _formData
  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  try {
    const requestHeaders = await headers()
    const response = await bypassTwoFactorPasswordStorage.run(true, () =>
      getAuth().api.enableTwoFactor({
        body: {},
        headers: requestHeaders,
      }),
    )

    if (!response || !response.totpURI) {
      return {
        error: {
          code: "INTERNAL_ERROR",
          message:
            "Could not initialize two-factor authentication. Please try again.",
        },
        ok: false,
      }
    }

    const totpURI = response.totpURI
    const url = new URL(totpURI)
    const secretKey = url.searchParams.get("secret") ?? ""

    const qrCodeDataUrl = await QRCode.toDataURL(totpURI, {
      color: {
        dark: "#0b132b",
        light: "#ffffff",
      },
      margin: 2,
      width: 220,
    })

    return {
      data: {
        qrCodeDataUrl,
        secretKey,
        totpURI,
      },
      ok: true,
    }
  } catch (error) {
    console.error("[enableTwoFactorAction error]:", error)
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not start two-factor setup. Please try again.",
      },
      ok: false,
    }
  }
}

async function syncResponseCookies(response: Response) {
  const cookieStore = await cookies()
  const rawSetCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter((c): c is string =>
          Boolean(c),
        )

  for (const cookieStr of rawSetCookies) {
    const parts = cookieStr.split(";").map((p) => p.trim())
    const nameValue = parts[0]
    if (!nameValue) continue
    const [name, ...valParts] = nameValue.split("=")
    if (!name) continue
    const value = valParts.join("=")

    const options: Parameters<typeof cookieStore.set>[2] = {}
    for (let i = 1; i < parts.length; i++) {
      const attr = parts[i]
      if (!attr) continue
      const [attrName, ...attrValParts] = attr.split("=")
      if (!attrName) continue
      const attrVal = attrValParts.join("=")
      const lower = attrName.toLowerCase()
      if (lower === "path") options.path = attrVal
      else if (lower === "max-age") options.maxAge = parseInt(attrVal, 10)
      else if (lower === "expires") options.expires = new Date(attrVal)
      else if (lower === "httponly") options.httpOnly = true
      else if (lower === "secure") options.secure = true
      else if (lower === "samesite") {
        const s = attrVal.toLowerCase()
        if (s === "lax" || s === "strict" || s === "none") {
          options.sameSite = s
        }
      }
    }
    try {
      cookieStore.set(name, value, options)
    } catch {}
  }
}

export async function confirmTwoFactorAction(
  _previousState: ConfirmTwoFactorState,
  formData: FormData,
): Promise<ConfirmTwoFactorState> {
  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  const parsed = confirmTwoFactorSchema.safeParse({
    code: formData.get("code"),
  })
  if (!parsed.success) {
    return validationFailure(
      "Check the 6-digit authenticator code and try again.",
      {
        code: parsed.error.flatten().fieldErrors.code ?? [
          "Enter the 6-digit code from Google Authenticator",
        ],
      },
    )
  }

  try {
    const requestHeaders = await headers()
    await preserveActiveSessionStorage.run(true, async () => {
      const response = await getAuth().api.verifyTOTP({
        asResponse: true,
        body: { code: parsed.data.code },
        headers: requestHeaders,
      })

      if (response instanceof Response) {
        await syncResponseCookies(response)
      }
    })
  } catch (error) {
    const errorCode =
      isAPIError(error) && typeof error.body?.code === "string"
        ? error.body.code
        : "UNKNOWN"

    return {
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: {
          code: [
            errorCode === "INVALID_CODE"
              ? "That code is incorrect. Enter the newest code from Google Authenticator."
              : "The authenticator code could not be verified.",
          ],
        },
        message: "The authenticator code could not be verified.",
      },
      ok: false,
    }
  }

  logSecurityEvent("authentication.two_factor_enabled", { userId: user.id })
  revalidatePath("/profile")

  return { data: { enabled: true }, ok: true }
}

export async function disableTwoFactorAction(
  _previousState: DisableTwoFactorState,
  _formData?: FormData,
): Promise<DisableTwoFactorState> {
  void _previousState
  void _formData
  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  try {
    const requestHeaders = await headers()
    await preserveActiveSessionStorage.run(true, () =>
      bypassTwoFactorPasswordStorage.run(true, async () => {
        const response = await getAuth().api.disableTwoFactor({
          asResponse: true,
          body: {},
          headers: requestHeaders,
        })

        if (response instanceof Response) {
          await syncResponseCookies(response)
        }
      }),
    )
  } catch (error) {
    console.error("[disableTwoFactorAction error]:", error)
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not disable two-factor authentication.",
      },
      ok: false,
    }
  }

  logSecurityEvent("authentication.two_factor_disabled", { userId: user.id })
  revalidatePath("/profile")

  return { data: { disabled: true }, ok: true }
}
