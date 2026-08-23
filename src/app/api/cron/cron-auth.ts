import "server-only"

import { timingSafeEqual } from "node:crypto"

import type { ServerEnv } from "@/lib/env/schema"
import { readServerEnv } from "@/lib/env/server"
import { incrementCounter } from "@/lib/observability/metrics"

type CronJobName =
  | "stale-rooms"
  | "stale-timers"
  | "reminders"
  | "attachments"
  | "overdue"
  | "retention"

const JOB_SECRET_KEY: Record<CronJobName, keyof ServerEnv> = {
  "stale-rooms": "CRON_SECRET_STALE_ROOMS",
  "stale-timers": "CRON_SECRET_STALE_TIMERS",
  reminders: "CRON_SECRET_REMINDERS",
  attachments: "CRON_SECRET_ATTACHMENTS",
  overdue: "CRON_SECRET_OVERDUE",
  retention: "CRON_SECRET_RETENTION",
}

function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf)
}

/**
 * Authenticates an incoming cron request using a timing-safe comparison.
 *
 * Vercel Cron always sends `Authorization: Bearer $CRON_SECRET`, so the
 * shared secret authorizes a request for every job. A per-job secret (e.g.
 * CRON_SECRET_STALE_ROOMS) is accepted in addition for schedulers that can
 * set custom headers; configuring one never invalidates the shared secret.
 * Returns true only when a configured secret authorizes the request.
 */
export function authorizeCronRequest(
  request: Request,
  job: CronJobName,
): boolean {
  const env = readServerEnv()
  const secrets = [
    env.CRON_SECRET,
    env[JOB_SECRET_KEY[job]] as string | undefined,
  ].filter((secret): secret is string => Boolean(secret))

  // Scheduled jobs mutate application state. Missing configuration must never
  // turn an endpoint into a public mutation route, including in development.
  if (secrets.length === 0) {
    incrementCounter("cron_auth_denied", { job })
    return false
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const authorized = secrets.some((secret) =>
    timingSafeCompare(authHeader, `Bearer ${secret}`),
  )
  if (!authorized) {
    incrementCounter("cron_auth_denied", { job })
  }
  return authorized
}
