import { describe, expect, it } from "vitest"

import { detectAllowedAttachmentMimeType } from "./file-signature"

describe("attachment byte signatures", () => {
  it.each([
    ["application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]],
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    [
      "image/webp",
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    ],
  ] as const)("detects %s from bytes", (mimeType, bytes) => {
    expect(detectAllowedAttachmentMimeType(Uint8Array.from(bytes))).toBe(
      mimeType,
    )
  })

  it("rejects executable, empty, and spoofed bytes", () => {
    expect(
      detectAllowedAttachmentMimeType(
        new TextEncoder().encode("MZ browser says image/png"),
      ),
    ).toBeNull()
    expect(detectAllowedAttachmentMimeType(new Uint8Array())).toBeNull()
  })
})
