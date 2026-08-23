import { authorizeCronRequest } from "@/app/api/cron/cron-auth"
import { getDatabase } from "@/db/client"
import { cleanupAbandonedAttachments } from "@/features/attachments/mutations/attachment-mutation-service"
import { sumRetainedAttachmentBytes } from "@/features/attachments/repositories/attachment-repository"
import { createR2AttachmentStorage } from "@/features/attachments/storage/r2-attachment-storage"
import { r2EnvFromServerEnv } from "@/lib/env/schema"
import { readServerEnv } from "@/lib/env/server"
import { logger } from "@/lib/observability/logger"
import {
  observeCronOutcome,
  observeStorageUsage,
} from "@/lib/observability/metrics"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Retained attachment bytes at which the cron run logs a warning. */
const storageAlertThresholdBytes = 5 * 1024 * 1024 * 1024

async function handleAttachmentCleanup(request: Request) {
  const env = readServerEnv()
  if (!authorizeCronRequest(request, "attachments")) {
    observeCronOutcome("attachments", "denied")
    return Response.json({ error: "Unauthorized." }, { status: 401 })
  }
  const r2 = r2EnvFromServerEnv(env)
  if (!r2) {
    return Response.json(
      { error: "Attachment cleanup unavailable." },
      { status: 503 },
    )
  }

  try {
    const summary = await cleanupAbandonedAttachments(
      getDatabase(),
      createR2AttachmentStorage(r2),
    )
    observeCronOutcome("attachments", "success")

    try {
      const totalBytes = await sumRetainedAttachmentBytes(getDatabase())
      observeStorageUsage(totalBytes, storageAlertThresholdBytes)
    } catch (usageError) {
      logger.warn("Attachment storage usage observation failed", {
        error:
          usageError instanceof Error ? usageError.message : String(usageError),
      })
    }

    return Response.json(summary, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    logger.error(
      "Attachment cleanup incident",
      error instanceof Error ? error : undefined,
      {
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "cleanup_failure",
      },
    )
    observeCronOutcome("attachments", "partial")
    return Response.json(
      { error: "Attachment cleanup failed." },
      { status: 500 },
    )
  }
}

export const GET = handleAttachmentCleanup
export const POST = handleAttachmentCleanup
