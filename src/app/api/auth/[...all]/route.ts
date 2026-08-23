import { getAuth } from "@/features/authentication/server/auth"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET(request: Request) {
  return getAuth().handler(request)
}

export async function POST(request: Request) {
  const limit = await enforceRateLimit({
    headers: request.headers,
    policy: "account",
  })
  if (limit && !limit.success) {
    return Response.json(
      { message: "Too many account requests. Please wait and try again." },
      { status: 429 },
    )
  }
  return getAuth().handler(request)
}
