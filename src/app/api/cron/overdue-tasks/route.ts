import { authorizeCronRequest } from "@/app/api/cron/cron-auth"
import { getDatabase } from "@/db/client"
import { processOverdueQuests } from "@/features/quests/processing/overdue-processor"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function handleOverdueJob(request: Request): Promise<Response> {
  if (!authorizeCronRequest(request, "overdue")) {
    return Response.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const summary = await processOverdueQuests(getDatabase())

    return Response.json(summary, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Overdue task processor incident", {
      code:
        error instanceof Error && "code" in error
          ? String(error.code)
          : "processor_failure",
      name: error instanceof Error ? error.name : typeof error,
    })
    return Response.json(
      { error: "Overdue task processing failed." },
      { status: 500 },
    )
  }
}

export const GET = handleOverdueJob
export const POST = handleOverdueJob
