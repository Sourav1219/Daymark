import { withHealthyAuth } from "@/features/authentication/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withHealthyAuth((auth) => auth.handler(request))
}

export async function POST(request: Request) {
  return withHealthyAuth((auth) => auth.handler(request))
}
