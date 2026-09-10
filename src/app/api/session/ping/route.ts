import { headers } from "next/headers"

import { getAuth } from "@/features/authentication/server/auth"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

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
  const requestHeaders = await headers()
  const limit = await enforceRateLimit({
    headers: requestHeaders,
    policy: "default",
  })
  if (limit && !limit.success) {
    return new Response(null, { headers: NO_STORE, status: 429 })
  }

  const session = await getAuth().api.getSession({
    headers: requestHeaders,
    query: {
      disableCookieCache: true,
      disableRefresh: true,
    },
  })

  if (!session) {
    return new Response(null, { headers: NO_STORE, status: 401 })
  }

  return new Response(null, { headers: NO_STORE, status: 204 })
}
