import { NextResponse } from "next/server"
import { z } from "zod"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { isTrustedOriginRequest } from "@/lib/http/same-origin"
import { stopActiveTimer } from "@/features/timer/mutations/timer-mutation-service"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"
import { readServerEnv } from "@/lib/env/server"

export const dynamic = "force-dynamic"

const bodySchema = z.object({ sessionId: z.uuid() })
const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
}

function allowedOrigins(): readonly string[] {
  return [new URL(readServerEnv().BETTER_AUTH_URL).origin]
}

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request, allowedOrigins())) {
    return NextResponse.json(
      { message: "Cross-site timer requests are not allowed." },
      { headers: responseHeaders, status: 403 },
    )
  }

  let value: unknown
  try {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > 1024) {
      return NextResponse.json(
        { message: "Timer request is too large." },
        { headers: responseHeaders, status: 413 },
      )
    }
    value = JSON.parse(text)
  } catch {
    return NextResponse.json(
      { message: "Enter a valid timer request." },
      { headers: responseHeaders, status: 400 },
    )
  }

  const parsed = bodySchema.safeParse(value)
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter a valid timer session." },
      { headers: responseHeaders, status: 422 },
    )
  }

  const access = await requireWorkspaceAccess()
  const limit = await enforceRateLimit({
    headers: request.headers,
    policy: "default",
    userId: access.userId,
  })
  if (limit && !limit.success) {
    return NextResponse.json(
      { message: "Too many timer requests." },
      { headers: responseHeaders, status: 429 },
    )
  }
  await stopActiveTimer(
    getDatabase(),
    access,
    parsed.data.sessionId,
    new Date(),
  )
  return new NextResponse(null, { headers: responseHeaders, status: 204 })
}
