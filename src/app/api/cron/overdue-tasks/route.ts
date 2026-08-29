import { authorizeCronRequest } from "@/app/api/cron/cron-auth"
import { getDatabase } from "@/db/client"
import { processOverdueQuests } from "@/features/quests/processing/overdue-processor"
import { logger } from "@/lib/observability/logger"
import { observeCronOutcome } from "@/lib/observability/metrics"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const noStore = { "Cache-Control": "no-store" } as const

async function handleOverdueJob(request: Request): Promise<Response> {
  if (!authorizeCronRequest(request, "overdue")) {
    observeCronOutcome("overdue", "denied")
    return Response.json(
      { error: "Unauthorized." },
      {
        headers: noStore,
        status: 401,
      },
    )
  }

  try {
    const summary = await processOverdueQuests(getDatabase())

    observeCronOutcome("overdue", "success")
    return Response.json(summary, { headers: noStore })
  } catch (error) {
    logger.error(
      "Overdue task processor incident",
      error instanceof Error ? error : undefined,
      {
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "processor_failure",
        name: error instanceof Error ? error.name : typeof error,
      },
    )
    observeCronOutcome("overdue", "failure")
    return Response.json(
      { error: "Overdue task processing failed." },
      { headers: noStore, status: 500 },
    )
  }
}

export const GET = handleOverdueJob
export const POST = handleOverdueJob
