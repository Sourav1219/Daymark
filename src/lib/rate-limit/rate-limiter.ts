import "server-only"

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

import { readServerEnv } from "@/lib/env/server"

const policies = {
  account: { requests: 10, window: "60 s" },
  attachment: { requests: 20, window: "60 s" },
  attachmentUpload: { requests: 8, window: "60 s" },
  default: { requests: 60, window: "60 s" },
  groupPoll: { requests: 40, window: "60 s" },
  groupStudyCreate: { requests: 5, window: "60 s" },
  groupStudyJoin: { requests: 10, window: "60 s" },
  offlineMutation: { requests: 30, window: "60 s" },
  pushSubscription: { requests: 10, window: "60 s" },
  timerHeartbeat: { requests: 6, window: "60 s" },
  timerStart: { requests: 20, window: "60 s" },
} as const satisfies Record<
  string,
  { requests: number; window: Parameters<typeof Ratelimit.slidingWindow>[1] }
>

export type RateLimitPolicy = keyof typeof policies
export type RateLimitResult = Awaited<ReturnType<Ratelimit["limit"]>>

let redis: Redis | undefined
const limiters = new Map<string, Ratelimit>()

function getRedis(): Redis | null {
  if (
    process.env.NODE_ENV !== "production" &&
    (!process.env.UPSTASH_REDIS_REST_URL ||
      !process.env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    return null
  }
  const env = readServerEnv()
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    // The environment schema makes this impossible in production. Local and
    // test environments intentionally remain usable without external Redis.
    return null
  }

  redis ??= new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })
  return redis
}

function limiter(policy: RateLimitPolicy, scope: "ip" | "user") {
  const client = getRedis()
  if (!client) return null

  const key = `${policy}:${scope}`
  let instance = limiters.get(key)
  if (!instance) {
    const rule = policies[policy]
    instance = new Ratelimit({
      analytics: false,
      limiter: Ratelimit.slidingWindow(rule.requests, rule.window),
      prefix: `daymark:rl:${policy}:${scope}`,
      redis: client,
    })
    limiters.set(key, instance)
  }
  return instance
}

/**
 * Resolves the rate-limit identity for one request.
 *
 * `x-vercel-forwarded-for` is stamped by the platform edge and cannot be
 * spoofed by clients. The generic forwarded headers are only honored when the
 * operator explicitly vouches for a trusted reverse proxy via
 * TRUST_FORWARDED_IP_HEADERS; otherwise every untrusted caller shares the
 * "unknown" bucket, which fails closed instead of letting an attacker rotate
 * spoofed headers across fresh limit windows.
 */
export function clientIp(requestHeaders: Headers): string {
  const platformIp = requestHeaders
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    ?.trim()
  if (platformIp) return platformIp

  if (readServerEnv().TRUST_FORWARDED_IP_HEADERS === true) {
    const forwardedIp =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip")?.trim()
    if (forwardedIp) return forwardedIp
  }

  return "unknown"
}

export async function enforceRateLimit(
  input: Readonly<{
    headers: Headers
    policy: RateLimitPolicy
    userId?: string
  }>,
): Promise<RateLimitResult | null> {
  const checks = [
    limiter(input.policy, "ip")?.limit(clientIp(input.headers)),
    input.userId
      ? limiter(input.policy, "user")?.limit(input.userId)
      : undefined,
  ].filter((check): check is Promise<RateLimitResult> => Boolean(check))

  if (checks.length === 0) return null

  // Charge both distributed counters. Any Redis outage fails closed instead
  // of silently admitting an expensive request.
  const results = await Promise.allSettled(checks)
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  )
  if (rejected) throw rejected.reason

  return results
    .filter(
      (result): result is PromiseFulfilledResult<RateLimitResult> =>
        result.status === "fulfilled",
    )
    .reduce(
      (strictest, result) =>
        !strictest || result.value.remaining < strictest.remaining
          ? result.value
          : strictest,
      null as RateLimitResult | null,
    )
}
