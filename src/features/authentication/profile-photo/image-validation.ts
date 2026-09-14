import {
  maximumProfilePhotoBytes,
  profilePhotoDimension,
} from "@/features/authentication/profile-photo/constants"

export type ProfilePhotoInspection = Readonly<{
  height: number
  width: number
}>

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length))
}

function littleEndian24(bytes: Uint8Array, start: number) {
  return bytes[start]! | (bytes[start + 1]! << 8) | (bytes[start + 2]! << 16)
}

/** Reads WebP dimensions without decoding untrusted image pixels. */
export function inspectWebp(bytes: Uint8Array): ProfilePhotoInspection | null {
  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    return null
  }

  const chunk = ascii(bytes, 12, 4)
  if (chunk === "VP8X") {
    return {
      height: littleEndian24(bytes, 27) + 1,
      width: littleEndian24(bytes, 24) + 1,
    }
  }

  if (
    chunk === "VP8 " &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff,
      width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
    }
  }

  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    return {
      height:
        1 +
        ((bytes[22]! >> 6) | (bytes[23]! << 2) | ((bytes[24]! & 0x0f) << 10)),
      width: 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8),
    }
  }

  return null
}

export function isValidProcessedProfilePhoto(bytes: Uint8Array) {
  if (bytes.length < 1 || bytes.length > maximumProfilePhotoBytes) return false
  const dimensions = inspectWebp(bytes)
  return (
    dimensions?.width === profilePhotoDimension &&
    dimensions.height === profilePhotoDimension
  )
}
