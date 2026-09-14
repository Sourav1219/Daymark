import { describe, expect, it } from "vitest"

import { profilePhotoDimension } from "./constants"
import { inspectWebp, isValidProcessedProfilePhoto } from "./image-validation"

function vp8x(width: number, height: number, byteLength = 64) {
  const bytes = new Uint8Array(byteLength)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  bytes.set([0x56, 0x50, 0x38, 0x58], 12)
  const storedWidth = width - 1
  const storedHeight = height - 1
  bytes.set(
    [storedWidth & 0xff, (storedWidth >> 8) & 0xff, (storedWidth >> 16) & 0xff],
    24,
  )
  bytes.set(
    [
      storedHeight & 0xff,
      (storedHeight >> 8) & 0xff,
      (storedHeight >> 16) & 0xff,
    ],
    27,
  )
  return bytes
}

describe("processed profile photo validation", () => {
  it("reads VP8X dimensions and accepts the normalized avatar size", () => {
    const bytes = vp8x(profilePhotoDimension, profilePhotoDimension)

    expect(inspectWebp(bytes)).toEqual({ height: 512, width: 512 })
    expect(isValidProcessedProfilePhoto(bytes)).toBe(true)
  })

  it("rejects a WebP with dimensions other than 512 square", () => {
    expect(isValidProcessedProfilePhoto(vp8x(512, 511))).toBe(false)
    expect(isValidProcessedProfilePhoto(vp8x(800, 800))).toBe(false)
  })

  it("rejects data that only claims the WebP MIME type", () => {
    expect(isValidProcessedProfilePhoto(new Uint8Array(64))).toBe(false)
  })
})
