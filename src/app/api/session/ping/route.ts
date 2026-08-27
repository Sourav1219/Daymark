import { headers } from "next/headers"

import { getAuth } from "@/features/authentication/server/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NO_STORE = { "Cache-Control": "no-store" } as const

/**
 * GET /api/session/ping
 *
 * A zero-body liveness probe for the current auth session.
 * The client-side SessionWatcher polls this to detect remote revocations
 * without requiring a full page refresh.
 *
 * 204 — session is alive
 * 401 — no valid session (expired, revoked, or cookie missing)
 */
export async function GET() {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return new Response(null, { headers: NO_STORE, status: 401 })
  }

  return new Response(null, { headers: NO_STORE, status: 204 })
}
