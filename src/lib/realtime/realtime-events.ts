import "server-only"

import { Redis } from "@upstash/redis"

import { readServerEnv } from "@/lib/env/server"

const encoder = new TextEncoder()
const heartbeatIntervalMs = 15_000

let redis: Redis | undefined

function getRealtimeRedis(): Redis | null {
  const env = readServerEnv()
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  redis ??= new Redis({
    token: env.UPSTASH_REDIS_REST_TOKEN,
    url: env.UPSTASH_REDIS_REST_URL,
  })
  return redis
}

export function roomRealtimeChannel(roomId: string) {
  return `traketo:realtime:room:${roomId}`
}

export function userSessionRealtimeChannel(userId: string) {
  return `traketo:realtime:user-sessions:${userId}`
}

/** Publishes best-effort invalidation without failing the committed mutation. */
export async function publishRealtimeEvent(
  channel: string,
  payload: Readonly<Record<string, unknown>>,
): Promise<boolean> {
  const client = getRealtimeRedis()
  if (!client) return false

  try {
    await client.publish(channel, payload)
    return true
  } catch {
    return false
  }
}

/**
 * Bridges an authenticated Upstash Pub/Sub channel to a browser EventSource.
 * Returns null outside production-style environments so callers can keep
 * their bounded polling fallback.
 */
export function createRealtimeEventResponse(
  request: Request,
  input: Readonly<{ channel: string; eventName: string }>,
): Response | null {
  const client = getRealtimeRedis()
  if (!client) return null

  const subscriber = client.subscribe<unknown>(input.channel)
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let cleanedUp = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (frame: string) => {
        if (!cleanedUp) controller.enqueue(encoder.encode(frame))
      }

      const cleanup = () => {
        if (cleanedUp) return
        cleanedUp = true
        if (heartbeat) clearInterval(heartbeat)
        request.signal.removeEventListener("abort", close)
        void subscriber.unsubscribe()
      }

      const close = () => {
        if (cleanedUp) return
        cleanup()
        try {
          controller.close()
        } catch {
          // The browser may have already cancelled the stream.
        }
      }

      subscriber.on("message", ({ message }) => {
        enqueue(
          `event: ${input.eventName}\ndata: ${JSON.stringify(message ?? null)}\n\n`,
        )
      })
      subscriber.on("error", close)

      request.signal.addEventListener("abort", close, { once: true })
      heartbeat = setInterval(
        () => enqueue(": keep-alive\n\n"),
        heartbeatIntervalMs,
      )
      enqueue("retry: 1000\n: connected\n\n")
    },
    cancel() {
      cleanedUp = true
      if (heartbeat) clearInterval(heartbeat)
      void subscriber.unsubscribe()
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, no-cache, no-store, max-age=0",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      Vary: "Cookie",
      "X-Accel-Buffering": "no",
    },
  })
}
