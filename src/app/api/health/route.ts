export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET() {
  return Response.json(
    {
      service: "traketo",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}
