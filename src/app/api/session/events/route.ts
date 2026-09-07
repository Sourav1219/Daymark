import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getAuth } from "@/features/authentication/server/auth"
import {
  createRealtimeEventResponse,
  userSessionRealtimeChannel,
} from "@/lib/realtime/realtime-events"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export const dynamic = "force-dynamic"
export const maxDuration = 300
export const runtime = "nodejs"

const noStoreHeaders = { "Cache-Control": "private, no-store" } as const

/** Streams account-wide session changes to every signed-in device. */
export async function GET(request: Request) {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session) {
    return new Response(null, { headers: noStoreHeaders, status: 401 })
  }

  const limit = await enforceRateLimit({
    headers: request.headers,
    policy: "groupPoll",
    userId: session.user.id,
  })
  if (limit && !limit.success) {
    return NextResponse.json(
      { message: "Too many session event stream connections." },
      { headers: noStoreHeaders, status: 429 },
    )
  }

  return (
    createRealtimeEventResponse(request, {
      channel: userSessionRealtimeChannel(session.user.id),
      eventName: "sessions-changed",
    }) ?? new Response(null, { headers: noStoreHeaders, status: 204 })
  )
}
