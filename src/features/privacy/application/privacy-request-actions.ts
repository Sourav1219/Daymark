"use server"

import { createHash, randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"

import { getDatabase } from "@/db/client"
import { getCurrentUser } from "@/features/authentication/server/authorization"
import {
  privacyRequestTypes,
  type PrivacyRequestView,
} from "@/features/privacy/domain/privacy-request"
import { createPrivacyRequest } from "@/features/privacy/repositories/privacy-request-repository"
import { validationFailure } from "@/lib/actions/action-helpers"
import type { ActionResult } from "@/lib/actions/action-result"
import { logSecurityEvent } from "@/lib/observability/logger"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

const privacyRequestSchema = z.object({
  details: z
    .string()
    .trim()
    .min(20, "Add at least 20 characters so the request can be reviewed")
    .max(2_000, "Keep request details to 2,000 characters or fewer"),
  guestEmail: z.union([z.literal(""), z.email("Enter a valid email address")]),
  type: z.enum(privacyRequestTypes),
})

export type PrivacyRequestActionState = ActionResult<{
  request: PrivacyRequestView
}> | null

export async function submitPrivacyRequestAction(
  _previousState: PrivacyRequestActionState,
  formData: FormData,
): Promise<PrivacyRequestActionState> {
  const parsed = privacyRequestSchema.safeParse({
    details: formData.get("details"),
    guestEmail: formData.get("guestEmail") ?? "",
    type: formData.get("type"),
  })
  if (!parsed.success) {
    return validationFailure(
      "Review the highlighted fields and try again.",
      parsed.error.flatten().fieldErrors,
    )
  }

  const user = await getCurrentUser()
  const requesterEmail = user?.email ?? parsed.data.guestEmail
  if (!requesterEmail) {
    return validationFailure("Enter an email address so we can reply.", {
      guestEmail: ["Enter an email address so we can reply"],
    })
  }

  const rateLimitIdentity = user?.id
    ? user.id
    : `guest:${createHash("sha256").update(requesterEmail).digest("hex")}`
  const limit = await enforceRateLimit({
    headers: await headers(),
    policy: "account",
    userId: rateLimitIdentity,
  })
  if (limit && !limit.success) {
    return {
      error: {
        code: "RATE_LIMITED",
        message: "Too many privacy requests. Please wait and try again.",
      },
      ok: false,
    }
  }

  try {
    const ticketNumber = `PR-${new Date().getUTCFullYear()}-${randomUUID()
      .replaceAll("-", "")
      .slice(0, 8)
      .toUpperCase()}`
    const request = await createPrivacyRequest(getDatabase(), {
      details: parsed.data.details,
      requesterEmail,
      ticketNumber,
      type: parsed.data.type,
      userId: user?.id ?? null,
    })

    logSecurityEvent("privacy.request_submitted", {
      requestType: parsed.data.type,
      ticketNumber,
      userId: user?.id ?? null,
    })
    revalidatePath("/privacy")
    return { data: { request }, ok: true }
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Your privacy request could not be saved. Please try again.",
      },
      ok: false,
    }
  }
}
