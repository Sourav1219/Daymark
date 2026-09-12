// @vitest-environment node

import { describe, expect, it } from "vitest"

import { createR2AttachmentStorage } from "./r2-attachment-storage"

describe("R2 attachment upload grants", () => {
  it("signs the authorized content length into direct upload URLs", async () => {
    const storage = createR2AttachmentStorage({
      accessKeyId: "access-key-at-least-16",
      accountId: "1234567890abcdef1234567890abcdef",
      bucketName: "traketo-attachments",
      secretAccessKey: "secret-key-that-is-at-least-32-characters",
    })

    const grant = await storage.createUploadGrant({
      byteSize: 1_024,
      contentType: "application/pdf",
      key: "workspaces/test/staging/object",
    })
    const signedHeaders = new URL(grant.url).searchParams.get(
      "X-Amz-SignedHeaders",
    )

    expect(signedHeaders?.split(";")).toContain("content-length")
    expect(grant.headers).toEqual({ "Content-Type": "application/pdf" })
  })
})
