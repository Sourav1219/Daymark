import { NextResponse } from "next/server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import {
  findActiveGroupStudyParticipant,
  updateParticipantHeartbeat,
} from "@/features/timer/repositories/group-study-repository"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export const dynamic = "force-dynamic"

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
}

/**
 * Heartbeat endpoint for active Group Study participants.
 *
 * Called by the client every 30 seconds while inside a room. Updates
 * lastHeartbeatAt on the participant record so the stale-room cron job
 * can detect disconnected participants and clean them up.
 */
export async function POST(request: Request) {
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

  const participant = await findActiveGroupStudyParticipant(database, access)

  if (!participant) {
    // Not in a room — nothing to update. Return 204 silently.
    return new NextResponse(null, { headers: responseHeaders, status: 204 })
  }

  await updateParticipantHeartbeat(database, access, participant.id)

  return new NextResponse(null, { headers: responseHeaders, status: 204 })
}
