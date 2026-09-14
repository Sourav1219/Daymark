import "server-only"

import { eq, sql } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { profilePhotos } from "@/db/schema"
import { profilePhotoDimension } from "@/features/authentication/profile-photo/constants"

export type ProfilePhotoRecord = Readonly<{
  byteSize: number
  contentType: string
  imageBase64: string
  version: number
}>

export async function findProfilePhotoRecord(
  database: DatabaseExecutor,
  userId: string,
): Promise<ProfilePhotoRecord | null> {
  const [record] = await database
    .select({
      byteSize: profilePhotos.byteSize,
      contentType: profilePhotos.contentType,
      imageBase64: profilePhotos.imageBase64,
      version: profilePhotos.version,
    })
    .from(profilePhotos)
    .where(eq(profilePhotos.userId, userId))
    .limit(1)

  return record ?? null
}

export async function saveProfilePhotoRecord(
  database: DatabaseExecutor,
  input: Readonly<{
    byteSize: number
    imageBase64: string
    userId: string
  }>,
): Promise<number> {
  const [saved] = await database
    .insert(profilePhotos)
    .values({
      byteSize: input.byteSize,
      height: profilePhotoDimension,
      imageBase64: input.imageBase64,
      userId: input.userId,
      width: profilePhotoDimension,
    })
    .onConflictDoUpdate({
      target: profilePhotos.userId,
      set: {
        byteSize: input.byteSize,
        height: profilePhotoDimension,
        imageBase64: input.imageBase64,
        updatedAt: new Date(),
        version: sql`${profilePhotos.version} + 1`,
        width: profilePhotoDimension,
      },
    })
    .returning({ version: profilePhotos.version })

  if (!saved) throw new Error("Unable to save the profile photo")
  return saved.version
}

export async function deleteProfilePhotoRecord(
  database: DatabaseExecutor,
  userId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(profilePhotos)
    .where(eq(profilePhotos.userId, userId))
    .returning({ userId: profilePhotos.userId })

  return deleted.length > 0
}

export function profilePhotoUrl(version: number) {
  return `/api/profile/photo?v=${version}`
}
