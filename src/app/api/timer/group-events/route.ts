import { NextResponse } from "next/server"
import { z } from "zod"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { findGroupStudyPollSnapshot } from "@/features/timer/repositories/group-study-repository"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"
import {
  createRealtimeEventResponse,
  roomRealtimeChannel,
} from "@/lib/realtime/realtime-events"

export const dynamic = "force-dynamic"
export const maxDuration = 300
export const runtime = "nodejs"

const querySchema = z.object({ roomId: z.uuid() })
const noStoreHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
} as const

/** Streams room invalidations only to an active room participant. */
export async function GET(request: Request) {
  const parsed = querySchema.safeParse({
    roomId: new URL(request.url).searchParams.get("roomId"),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { message: "A valid roomId is required." },
      { headers: noStoreHeaders, status: 422 },
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
      { message: "Too many room connections." },
      { headers: noStoreHeaders, status: 429 },
    )
  }

  const room = await findGroupStudyPollSnapshot(
    getDatabase(),
    access,
    parsed.data.roomId,
  )
  if (!room) {
    return NextResponse.json(
      { message: "Room not found." },
      { headers: noStoreHeaders, status: 404 },
    )
  }

  return (
    createRealtimeEventResponse(request, {
      channel: roomRealtimeChannel(parsed.data.roomId),
      eventName: "room-changed",
    }) ?? new Response(null, { headers: noStoreHeaders, status: 204 })
  )
}
