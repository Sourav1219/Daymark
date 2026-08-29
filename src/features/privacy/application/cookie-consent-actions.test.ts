import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  cookieConsentMaxAgeSeconds,
  cookieConsentName,
  cookieConsentValues,
} from "@/features/privacy/domain/cookie-consent"

import { saveCookieConsentAction } from "./cookie-consent-actions"

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  set: vi.fn(),
}))

vi.mock("next/headers", () => ({ cookies: mocks.cookies }))

describe("saveCookieConsentAction", () => {
  beforeEach(() => {
    mocks.cookies.mockReset()
    mocks.set.mockReset()
    mocks.cookies.mockResolvedValue({ set: mocks.set })
  })

  it("stores a bounded first-party consent preference", async () => {
    await expect(saveCookieConsentAction("preferences")).resolves.toBe(
      "preferences",
    )

    expect(mocks.set).toHaveBeenCalledWith(
      cookieConsentName,
      cookieConsentValues.preferences,
      {
        httpOnly: false,
        maxAge: cookieConsentMaxAgeSeconds,
        path: "/",
        sameSite: "lax",
        secure: false,
      },
    )
  })

  it("ignores an unknown consent category without throwing", async () => {
    await expect(
      saveCookieConsentAction("analytics" as "essential"),
    ).resolves.toBeNull()
    expect(mocks.set).not.toHaveBeenCalled()
  })
})
