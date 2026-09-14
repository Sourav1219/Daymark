export const profilePhotoDimension = 512
export const maximumProfilePhotoBytes = 400 * 1_024
export const maximumProfilePhotoSourceBytes = 8 * 1_024 * 1_024
export const maximumProfilePhotoSourcePixels = 40_000_000

export const allowedProfilePhotoSourceTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const
