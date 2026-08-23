import { authorizeCronRequest } from "@/app/api/cron/cron-auth"
import { getDatabase } from "@/db/client"
import { createReminderDeliveryProvider } from "@/features/reminders/delivery/resend-reminder-provider"
import { processDueReminders } from "@/features/reminders/processing/reminder-processor"
import { readServerEnv } from "@/lib/env/server"
import { emailFromServerEnv } from "@/lib/env/schema"
import { logger } from "@/lib/observability/logger"
import {
  observeCronOutcome,
  observeReminderBacklog,
} from "@/lib/observability/metrics"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Backlog size at which the cron run logs an explicit warning. */
const reminderBacklogAlertThreshold = 100

async function handleReminderJob(request: Request): Promise<Response> {
  const env = readServerEnv()

  if (!authorizeCronRequest(request, "reminders")) {
    observeCronOutcome("reminders", "denied")
    return Response.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const summary = await processDueReminders(
      getDatabase(),
      createReminderDeliveryProvider({
        apiKey: env.RESEND_API_KEY,
        appUrl: env.BETTER_AUTH_URL,
        from: env.REMINDER_FROM_EMAIL ?? emailFromServerEnv(env),
      }),
      {
        ...(env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY && env.VAPID_SUBJECT
          ? {
              push: {
                privateKey: env.VAPID_PRIVATE_KEY,
                publicKey: env.VAPID_PUBLIC_KEY,
                subject: env.VAPID_SUBJECT,
              },
            }
          : {}),
      },
    )
    observeCronOutcome("reminders", summary.failed > 0 ? "partial" : "success")
    if (summary.remainingDue >= reminderBacklogAlertThreshold) {
      observeReminderBacklog(summary.remainingDue)
    }

    return Response.json(summary, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    logger.error(
      "Reminder processor incident",
      error instanceof Error ? error : undefined,
      {
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "processor_failure",
      },
    )
    observeCronOutcome("reminders", "partial")
    return Response.json(
      { error: "Reminder processing failed." },
      { status: 500 },
    )
  }
}

export const GET = handleReminderJob
export const POST = handleReminderJob
