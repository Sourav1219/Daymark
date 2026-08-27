import { NextResponse } from "next/server"
import { z } from "zod"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { findGroupStudyPollSnapshot } from "@/features/timer/repositories/group-study-repository"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export const dynamic = "force-dynamic"

const querySchema = z.object({ roomId: z.uuid() })

const responseHeaders = {
  "Cache-Control": "private, no-cache, max-age=0",
  Vary: "Cookie",
}

/**
 * Lightweight polling endpoint for Group Study rooms.
 *
 * Returns { version, participantCount } for the given roomId.
 * Clients compare the version to their last-seen value and only call
 * router.refresh() when it changes — avoiding a full server render every
 * poll interval regardless of whether anything changed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ roomId: searchParams.get("roomId") })

  if (!parsed.success) {
    return NextResponse.json(
      { message: "A valid roomId is required." },
      { headers: responseHeaders, status: 422 },
    )
  }

  const access = await requireWorkspaceAccess()
  const limit = await enforceRateLimit({
    headers: request.headers,
    policy: "groupPoll",
    userId: access.userId,
  })
  if (limit && !limit.success) {
    return NextResponse.json(
      { message: "Polling too quickly." },
      { headers: responseHeaders, status: 429 },
    )
  }

  const database = getDatabase()
  const snapshot = await findGroupStudyPollSnapshot(
    database,
    access,
    parsed.data.roomId,
  )

  if (!snapshot) {
    return NextResponse.json(
      { message: "Room not found." },
      { headers: responseHeaders, status: 404 },
    )
  }

  return NextResponse.json(snapshot, { headers: responseHeaders })
}
