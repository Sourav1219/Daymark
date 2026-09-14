import { getDatabase } from "@/db/client"
import { getCurrentUser } from "@/features/authentication/server/authorization"
import { findProfilePhotoRecord } from "@/features/authentication/repositories/profile-photo-repository"

const privateImageHeaders = {
  "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
  "Content-Disposition": 'inline; filename="profile-photo.webp"',
  "X-Content-Type-Options": "nosniff",
} as const

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json(
      { error: "Authentication required." },
      { headers: { "Cache-Control": "private, no-store" }, status: 401 },
    )
  }

  const photo = await findProfilePhotoRecord(getDatabase(), user.id)
  if (!photo) {
    return Response.json(
      { error: "Profile photo not found." },
      { headers: { "Cache-Control": "private, no-store" }, status: 404 },
    )
  }

  const eTag = `"profile-photo-${user.id}-${photo.version}"`
  if (request.headers.get("if-none-match") === eTag) {
    return new Response(null, {
      headers: { ...privateImageHeaders, ETag: eTag },
      status: 304,
    })
  }

  const image = Buffer.from(photo.imageBase64, "base64")
  return new Response(new Uint8Array(image), {
    headers: {
      ...privateImageHeaders,
      "Content-Length": String(image.byteLength),
      "Content-Type": photo.contentType,
      ETag: eTag,
    },
  })
}
