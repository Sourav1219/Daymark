import { describe, expect, it } from "vitest"

import {
  cookieConsentValues,
  parseCookieConsent,
} from "@/features/privacy/domain/cookie-consent"

describe("parseCookieConsent", () => {
  it("accepts only the current consent version and known choices", () => {
    expect(parseCookieConsent(cookieConsentValues.essential)).toBe("essential")
    expect(parseCookieConsent(cookieConsentValues.preferences)).toBe(
      "preferences",
    )
    expect(parseCookieConsent("v0.preferences")).toBeNull()
    expect(parseCookieConsent(undefined)).toBeNull()
  })
})
