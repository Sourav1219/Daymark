// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  deleteProfilePhotoRecord: vi.fn(),
  enforceRateLimit: vi.fn(),
  getDatabase: vi.fn(),
  logSecurityEvent: vi.fn(),
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  saveProfilePhotoRecord: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))
vi.mock("@/db/client", () => ({ getDatabase: mocks.getDatabase }))
vi.mock("@/features/authentication/server/authorization", () => ({
  requireUser: mocks.requireUser,
}))
vi.mock(
  "@/features/authentication/repositories/profile-photo-repository",
  () => ({
    deleteProfilePhotoRecord: mocks.deleteProfilePhotoRecord,
    profilePhotoUrl: (version: number) => `/api/profile/photo?v=${version}`,
    saveProfilePhotoRecord: mocks.saveProfilePhotoRecord,
  }),
)
vi.mock("@/lib/observability/logger", () => ({
  logSecurityEvent: mocks.logSecurityEvent,
}))
vi.mock("@/lib/rate-limit/rate-limiter", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))

import {
  deleteProfilePhotoAction,
  updateProfilePhotoAction,
} from "./profile-photo-actions"

function vp8xPhoto() {
  const bytes = new Uint8Array(64)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  bytes.set([0x56, 0x50, 0x38, 0x58], 12)
  bytes.set([0xff, 0x01, 0], 24)
  bytes.set([0xff, 0x01, 0], 27)
  return new File([bytes], "avatar.webp", { type: "image/webp" })
}

describe("profile photo actions", () => {
  const database = { kind: "test" }
  const user = { id: "8245084b-e2c9-43c0-97c1-6ee8420d4a88" }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deleteProfilePhotoRecord.mockResolvedValue(true)
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.getDatabase.mockReturnValue(database)
    mocks.requireUser.mockResolvedValue(user)
    mocks.saveProfilePhotoRecord.mockResolvedValue(3)
  })

  it("validates the image bytes before saving", async () => {
    const form = new FormData()
    form.set(
      "photo",
      new File([new Uint8Array(64)], "fake.webp", { type: "image/webp" }),
    )

    await expect(updateProfilePhotoAction(form)).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
      ok: false,
    })
    expect(mocks.saveProfilePhotoRecord).not.toHaveBeenCalled()
  })

  it("stores a validated photo under the authenticated user", async () => {
    const form = new FormData()
    form.set("photo", vp8xPhoto())

    await expect(updateProfilePhotoAction(form)).resolves.toEqual({
      data: { photoUrl: "/api/profile/photo?v=3" },
      ok: true,
    })
    expect(mocks.saveProfilePhotoRecord).toHaveBeenCalledWith(
      database,
      expect.objectContaining({
        byteSize: 64,
        userId: user.id,
      }),
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout")
  })

  it("removes only the authenticated user's photo", async () => {
    await expect(deleteProfilePhotoAction()).resolves.toEqual({
      data: { photoUrl: null },
      ok: true,
    })
    expect(mocks.deleteProfilePhotoRecord).toHaveBeenCalledWith(
      database,
      user.id,
    )
  })
})
