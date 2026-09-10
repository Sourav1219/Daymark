// @vitest-environment node

import { describe, expect, it } from "vitest"

import { registrationAcceptanceHeaderName } from "@/features/authentication/domain/registration-acceptance"
import {
  createRegistrationAcceptanceToken,
  readRegistrationAcceptance,
} from "./registration-acceptance"

const secret = "registration-test-secret-at-least-32-characters"

describe("registration acceptance receipts", () => {
  it("reads a current signed receipt for the expected registration method", () => {
    const acceptedAt = new Date("2026-09-10T10:00:00.000Z")
    const headers = new Headers({
      [registrationAcceptanceHeaderName]: createRegistrationAcceptanceToken(
        secret,
        "email",
        acceptedAt,
      ),
    })

    expect(
      readRegistrationAcceptance(
        headers,
        secret,
        "email",
        new Date("2026-09-10T10:05:00.000Z"),
      ),
    ).toEqual({
      acceptedAt,
      ageRequirementVersion: "2026-09-10",
      privacyNoticeVersion: "2026-08-28",
      source: "email",
      termsVersion: "2026-08-28",
    })
  })

  it("rejects tampered, expired, and wrong-method receipts", () => {
    const token = createRegistrationAcceptanceToken(
      secret,
      "google",
      new Date("2026-09-10T10:00:00.000Z"),
    )
    const cookieHeaders = new Headers({
      cookie: `another=value; traketo_registration_acceptance=${token}`,
    })

    expect(
      readRegistrationAcceptance(
        cookieHeaders,
        secret,
        "email",
        new Date("2026-09-10T10:01:00.000Z"),
      ),
    ).toBeNull()
    expect(
      readRegistrationAcceptance(
        cookieHeaders,
        secret,
        "google",
        new Date("2026-09-10T10:11:00.000Z"),
      ),
    ).toBeNull()

    cookieHeaders.set("cookie", `traketo_registration_acceptance=${token}x`)
    expect(
      readRegistrationAcceptance(
        cookieHeaders,
        secret,
        "google",
        new Date("2026-09-10T10:01:00.000Z"),
      ),
    ).toBeNull()
  })
})
