"use server"

import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"

import { getDatabase } from "@/db/client"
import {
  getCurrentSessionId,
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
import { getAuth } from "@/features/authentication/server/auth"
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
import {
  cookieConsentName,
  parseCookieConsent,
} from "@/features/privacy/domain/cookie-consent"

export type SessionView = Readonly<{
  createdAt: string
  expiresAt: string
  id: string
  ipAddress: string | null
  userAgent: string | null
}>

export type ExportDataState = ActionResult<{
  json: {
    base64: string
    filename: string
    mimeType: "application/json"
  }
  pdf: {
    base64: string
    filename: string
    mimeType: "application/pdf"
  } | null
  summary: {
    consentRecords: number
    sessions: number
    sharedGroups: number
    tasks: number
    workspaces: number
  }
}> | null
export type DeleteAccountState = ActionResult<{ deleted: true }> | null

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
const exportAccountDataSchema = z.object({
  includePdf: z.boolean(),
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

export async function exportAccountDataAction(input: {
  includePdf: boolean
}): Promise<ExportDataState> {
  const access = await requireWorkspaceAccess()
  const user = await requireUser()
  const limited = await accountRateLimitFailure(user.id)
  if (limited) return limited

  const parsed = exportAccountDataSchema.safeParse(input)
  if (!parsed.success) {
    return validationFailure("Choose a valid export format and try again.", {})
  }

  const [currentSessionId, cookieStore] = await Promise.all([
    getCurrentSessionId(),
    cookies(),
  ])
  const cookieConsent = parseCookieConsent(
    cookieStore.get(cookieConsentName)?.value,
  )
  const payload = await buildAccountExport(getDatabase(), access, {
    browserPreferenceConsent:
      cookieConsent === null
        ? null
        : {
            personalization: cookieConsent === "preferences",
            preferences: cookieConsent === "preferences",
          },
    currentSessionId,
  })
  const pdf = parsed.data.includePdf
    ? await buildAccountExportPdf(payload)
    : null
  const date = new Date().toISOString().slice(0, 10)
  const count = (key: string) => {
    const value = payload[key]
    return Array.isArray(value) ? value.length : 0
  }

  return {
    data: {
      json: {
        base64: Buffer.from(JSON.stringify(payload, null, 2)).toString(
          "base64",
        ),
        filename: `traketo-export-${date}.json`,
        mimeType: "application/json",
      },
      pdf: pdf
        ? {
            base64: Buffer.from(pdf).toString("base64"),
            filename: `traketo-export-${date}.pdf`,
            mimeType: "application/pdf",
          }
        : null,
      summary: {
        consentRecords: count("consentHistory"),
        sessions: count("sessions"),
        sharedGroups: count("sharedGroups"),
        tasks: count("tasks"),
        workspaces: count("workspaces"),
      },
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
