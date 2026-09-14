"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { getDatabase } from "@/db/client"
import { requireUser } from "@/features/authentication/server/authorization"
import {
  maximumProfilePhotoBytes,
  profilePhotoDimension,
} from "@/features/authentication/profile-photo/constants"
import { isValidProcessedProfilePhoto } from "@/features/authentication/profile-photo/image-validation"
import {
  deleteProfilePhotoRecord,
  profilePhotoUrl,
  saveProfilePhotoRecord,
} from "@/features/authentication/repositories/profile-photo-repository"
import type { ActionResult } from "@/lib/actions/action-result"
import { validationFailure } from "@/lib/actions/action-helpers"
import { logSecurityEvent } from "@/lib/observability/logger"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export type ProfilePhotoActionResult = ActionResult<{
  photoUrl: string | null
}>

async function photoRateLimitFailure(userId: string) {
  const limit = await enforceRateLimit({
    headers: await headers(),
    policy: "account",
    userId,
  })
  return limit && !limit.success
    ? ({
        error: {
          code: "RATE_LIMITED",
          message: "Too many profile updates. Please wait and try again.",
        },
        ok: false,
      } as const)
    : null
}

export async function updateProfilePhotoAction(
  formData: FormData,
): Promise<ProfilePhotoActionResult> {
  const user = await requireUser()
  const limited = await photoRateLimitFailure(user.id)
  if (limited) return limited

  const photo = formData.get("photo")
  if (!(photo instanceof File)) {
    return validationFailure("Choose a profile photo and try again.", {
      photo: ["A processed profile photo is required."],
    })
  }
  if (
    photo.type !== "image/webp" ||
    photo.size < 1 ||
    photo.size > maximumProfilePhotoBytes
  ) {
    return validationFailure("The processed profile photo is not valid.", {
      photo: [
        `Use a ${profilePhotoDimension}×${profilePhotoDimension} WebP under 400 KiB.`,
      ],
    })
  }

  const bytes = new Uint8Array(await photo.arrayBuffer())
  if (!isValidProcessedProfilePhoto(bytes)) {
    return validationFailure("The processed profile photo is not valid.", {
      photo: [
        `Use a genuine ${profilePhotoDimension}×${profilePhotoDimension} WebP under 400 KiB.`,
      ],
    })
  }

  try {
    const version = await saveProfilePhotoRecord(getDatabase(), {
      byteSize: bytes.byteLength,
      imageBase64: Buffer.from(bytes).toString("base64"),
      userId: user.id,
    })
    logSecurityEvent("profile.photo_updated", { userId: user.id })
    revalidatePath("/", "layout")
    return { data: { photoUrl: profilePhotoUrl(version) }, ok: true }
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Your profile photo could not be saved. Please try again.",
      },
      ok: false,
    }
  }
}

export async function deleteProfilePhotoAction(): Promise<ProfilePhotoActionResult> {
  const user = await requireUser()
  const limited = await photoRateLimitFailure(user.id)
  if (limited) return limited

  try {
    await deleteProfilePhotoRecord(getDatabase(), user.id)
    logSecurityEvent("profile.photo_deleted", { userId: user.id })
    revalidatePath("/", "layout")
    return { data: { photoUrl: null }, ok: true }
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Your profile photo could not be removed. Please try again.",
      },
      ok: false,
    }
  }
}
