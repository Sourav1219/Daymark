import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"

import { getDatabase } from "@/db/client"
import { readServerEnv } from "@/lib/env/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const readinessCacheTtlMs = 5_000

type ReadinessStatus = "ready" | "unavailable"

let cachedReadiness:
  Readonly<{ expiresAt: number; status: ReadinessStatus }> | undefined
let activeProbe: Promise<ReadinessStatus> | undefined

function hasReadinessAccess(request: Request, secret: string) {
  const supplied = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  )
}

async function checkDatabaseReadiness(): Promise<ReadinessStatus> {
  const now = Date.now()
  if (cachedReadiness && cachedReadiness.expiresAt > now) {
    return cachedReadiness.status
  }

  activeProbe ??= (async () => {
    let status: ReadinessStatus
    try {
      await getDatabase().execute(sql`SELECT 1`)
      status = "ready"
    } catch (error) {
      console.error("Readiness probe failed", {
        name: error instanceof Error ? error.name : typeof error,
      })
      status = "unavailable"
    }

    cachedReadiness = {
      expiresAt: Date.now() + readinessCacheTtlMs,
      status,
    }
    return status
  })().finally(() => {
    activeProbe = undefined
  })

  return activeProbe
}

function hiddenResponse() {
  return new Response(null, {
    headers: { "Cache-Control": "no-store" },
    status: 404,
  })
}

export async function GET(request: Request) {
  const secret = readServerEnv().READINESS_SECRET
  if (!secret || !hasReadinessAccess(request, secret)) {
    return hiddenResponse()
  }

  const status = await checkDatabaseReadiness()

  return NextResponse.json(
    { status },
    {
      headers: { "Cache-Control": "private, no-store" },
      status: status === "ready" ? 200 : 503,
    },
  )
}
