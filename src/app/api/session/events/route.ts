export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const noStoreHeaders = { "Cache-Control": "private, no-store" } as const

/**
 * Compatibility endpoint for tabs opened before the polling-based session
 * watcher was deployed. EventSource treats 204 as a terminal response, so an
 * old tab stops reconnecting instead of keeping a function alive until timeout.
 */
export function GET() {
  return new Response(null, { headers: noStoreHeaders, status: 204 })
}
