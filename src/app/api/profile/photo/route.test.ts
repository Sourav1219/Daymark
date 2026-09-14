// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findProfilePhotoRecord: vi.fn(),
  getCurrentUser: vi.fn(),
  getDatabase: vi.fn(),
}))

vi.mock("@/db/client", () => ({ getDatabase: mocks.getDatabase }))
vi.mock("@/features/authentication/server/authorization", () => ({
  getCurrentUser: mocks.getCurrentUser,
}))
vi.mock(
  "@/features/authentication/repositories/profile-photo-repository",
  () => ({
    findProfilePhotoRecord: mocks.findProfilePhotoRecord,
  }),
)

import { GET } from "./route"

describe("profile photo route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDatabase.mockReturnValue({ kind: "test" })
  })

  it("does not expose photos to unauthenticated requests", async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await GET(
      new Request("https://traketo.test/api/profile/photo"),
    )

    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(mocks.findProfilePhotoRecord).not.toHaveBeenCalled()
  })

  it("serves only the current user's private image with an ETag", async () => {
    const user = { id: "8245084b-e2c9-43c0-97c1-6ee8420d4a88" }
    mocks.getCurrentUser.mockResolvedValue(user)
    mocks.findProfilePhotoRecord.mockResolvedValue({
      byteSize: 4,
      contentType: "image/webp",
      imageBase64: Buffer.from([1, 2, 3, 4]).toString("base64"),
      version: 7,
    })

    const response = await GET(
      new Request("https://traketo.test/api/profile/photo?v=7"),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/webp")
    expect(response.headers.get("cache-control")).toContain("private")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    )
    expect(mocks.findProfilePhotoRecord).toHaveBeenCalledWith(
      { kind: "test" },
      user.id,
    )
  })
})
