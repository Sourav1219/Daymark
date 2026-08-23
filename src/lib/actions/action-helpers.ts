import "server-only"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import {
  enforceRateLimit,
  type RateLimitPolicy,
} from "@/lib/rate-limit/rate-limiter"
import type {
  ActionErrorCode,
  ActionFailure,
  ActionResult,
} from "@/lib/actions/action-result"
import { observeRateLimitHit } from "@/lib/observability/metrics"
import { logger } from "@/lib/observability/logger"
import { resolveRequestId } from "@/lib/observability/request-context"

type ExpectedActionError = Readonly<{
  code: ActionErrorCode
  message: string
}>

export function validationFailure(
  message: string,
  fieldErrors: Readonly<Record<string, readonly string[] | undefined>>,
): ActionFailure {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).filter(
          (entry): entry is [string, readonly string[]] =>
            entry[1] !== undefined,
        ),
      ),
      message,
    },
  }
}

function rateLimitFailure(): ActionFailure {
  return {
    ok: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please slow down and try again shortly.",
    },
  }
}

function unexpectedFailure(
  system: string,
  error: unknown,
  requestId: string,
): ActionFailure {
  const incidentId = randomUUID()
  const details =
    error instanceof Error
      ? {
          code:
            "code" in error && typeof error.code === "string"
              ? error.code
              : undefined,
          name: error.name,
        }
      : { type: typeof error }

  logger.error(
    `${system} action incident`,
    error instanceof Error ? error : undefined,
    {
      details,
      incident_id: incidentId,
      request_id: requestId,
      system,
    },
  )

  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: `${system} systems could not complete the request. Incident ${incidentId}.`,
    },
  }
}

export async function runActionMutation<T>({
  isExpectedError,
  mutate,
  paths,
  rateLimit,
  system,
}: Readonly<{
  isExpectedError: (error: unknown) => error is ExpectedActionError
  mutate: () => Promise<T>
  paths: readonly string[]
  rateLimit: Readonly<{ policy: RateLimitPolicy; userId: string }>
  system: string
}>): Promise<ActionResult<T>> {
  const requestId = await resolveRequestId()
  try {
    const limit = await enforceRateLimit({
      headers: await headers(),
      policy: rateLimit.policy,
      userId: rateLimit.userId,
    })
    if (limit && !limit.success) {
      observeRateLimitHit(rateLimit.policy)
      return rateLimitFailure()
    }

    const data = await mutate()

    for (const path of paths) {
      revalidatePath(path)
    }

    return { data, ok: true }
  } catch (error) {
    return isExpectedError(error)
      ? { error: { code: error.code, message: error.message }, ok: false }
      : unexpectedFailure(system, error, requestId)
  }
}
