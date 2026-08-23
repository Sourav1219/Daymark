import { describe, expect, it } from "vitest"

import { maximumAttachmentBytes } from "@/features/attachments/domain/types"
import { requestAttachmentUploadSchema } from "./attachment-validation"

const questId = "11111111-1111-4111-8111-111111111111"

describe("attachment upload validation", () => {
  it("accepts only bounded allowlisted upload declarations", () => {
    expect(
      requestAttachmentUploadSchema.safeParse({
        byteSize: maximumAttachmentBytes,
        mimeType: "application/pdf",
        questId,
      }).success,
    ).toBe(true)

    for (const input of [
      { byteSize: 0, mimeType: "image/png", questId },
      {
        byteSize: maximumAttachmentBytes + 1,
        mimeType: "image/png",
        questId,
      },
      { byteSize: 100, mimeType: "image/svg+xml", questId },
      {
        byteSize: 100,
        fileName: "trusted.pdf",
        mimeType: "application/pdf",
        questId,
      },
    ]) {
      expect(requestAttachmentUploadSchema.safeParse(input).success).toBe(false)
    }
  })
})
