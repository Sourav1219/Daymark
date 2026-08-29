import { NextResponse } from "next/server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { isTrustedOriginRequest } from "@/lib/http/same-origin"
import { updateActiveParticipantHeartbeat } from "@/features/timer/repositories/group-study-repository"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"
import { readServerEnv } from "@/lib/env/server"

export const dynamic = "force-dynamic"

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
}

function allowedOrigins(): readonly string[] {
  return [new URL(readServerEnv().BETTER_AUTH_URL).origin]
}

/**
 * Heartbeat endpoint for active Group Study participants.
 *
 * Called by the client every 60 seconds while inside a room. Updates
 * lastHeartbeatAt on the participant record so the stale-room cron job
 * can detect disconnected participants and clean them up.
 */
export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request, allowedOrigins())) {
    return NextResponse.json(
      { message: "Cross-site heartbeat requests are not allowed." },
      { headers: responseHeaders, status: 403 },
    )
  }

  const access = await requireWorkspaceAccess()
  const limit = await enforceRateLimit({
    headers: request.headers,
    policy: "timerHeartbeat",
    userId: access.userId,
  })
  if (limit && !limit.success) {
    return NextResponse.json(
      { message: "Heartbeat rate exceeded." },
      { headers: responseHeaders, status: 429 },
    )
  }
  const database = getDatabase()

  // A single guarded update is a no-op when the caller is not in an active
  // room, avoiding a separate participant lookup on every heartbeat.
  await updateActiveParticipantHeartbeat(database, access)

  return new NextResponse(null, { headers: responseHeaders, status: 204 })
}
