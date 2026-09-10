import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import {
  registrationAgeRequirementVersion,
  registrationAcceptanceCookieName,
  registrationAcceptanceHeaderName,
  registrationPrivacyNoticeVersion,
  registrationTermsVersion,
  type RegistrationAcceptance,
  type RegistrationSource,
} from "@/features/authentication/domain/registration-acceptance"

const acceptanceLifetimeMilliseconds = 10 * 60 * 1_000
const allowedClockSkewMilliseconds = 30 * 1_000

type AcceptancePayload = Readonly<{
  acceptedAt: string
  ageRequirementVersion: string
  privacyNoticeVersion: string
  source: RegistrationSource
  termsVersion: string
}>

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url")
}

export function createRegistrationAcceptanceToken(
  secret: string,
  source: RegistrationSource,
  acceptedAt = new Date(),
): string {
  const payload: AcceptancePayload = {
    acceptedAt: acceptedAt.toISOString(),
    ageRequirementVersion: registrationAgeRequirementVersion,
    privacyNoticeVersion: registrationPrivacyNoticeVersion,
    source,
    termsVersion: registrationTermsVersion,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  )

  return `${encodedPayload}.${sign(encodedPayload, secret)}`
}

function cookieValue(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null

  for (const item of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=")
    if (rawName === registrationAcceptanceCookieName) {
      return rawValue.join("=") || null
    }
  }

  return null
}

function parseToken(
  token: string | null,
  secret: string,
  expectedSource: RegistrationSource,
  now: Date,
): RegistrationAcceptance | null {
  if (!token) return null

  const [encodedPayload, suppliedSignature, ...extra] = token.split(".")
  if (!encodedPayload || !suppliedSignature || extra.length > 0) return null

  const expectedSignature = sign(encodedPayload, secret)
  const suppliedBuffer = Buffer.from(suppliedSignature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<AcceptancePayload>
    const acceptedAt = new Date(payload.acceptedAt ?? "")
    const age = now.getTime() - acceptedAt.getTime()

    if (
      Number.isNaN(acceptedAt.getTime()) ||
      age < -allowedClockSkewMilliseconds ||
      age > acceptanceLifetimeMilliseconds ||
      payload.source !== expectedSource ||
      payload.ageRequirementVersion !== registrationAgeRequirementVersion ||
      payload.termsVersion !== registrationTermsVersion ||
      payload.privacyNoticeVersion !== registrationPrivacyNoticeVersion
    ) {
      return null
    }

    return {
      acceptedAt,
      ageRequirementVersion: payload.ageRequirementVersion,
      privacyNoticeVersion: payload.privacyNoticeVersion,
      source: payload.source,
      termsVersion: payload.termsVersion,
    }
  } catch {
    return null
  }
}

export function readRegistrationAcceptance(
  headers: Headers | undefined,
  secret: string,
  expectedSource: RegistrationSource,
  now = new Date(),
): RegistrationAcceptance | null {
  const token =
    headers?.get(registrationAcceptanceHeaderName) ??
    cookieValue(headers?.get("cookie") ?? null)

  return parseToken(token, secret, expectedSource, now)
}

export function registrationAcceptanceUserFields(
  acceptance: RegistrationAcceptance,
) {
  return {
    ageConfirmedAt: acceptance.acceptedAt,
    ageRequirementVersion: acceptance.ageRequirementVersion,
    privacyNoticeAcknowledgedAt: acceptance.acceptedAt,
    privacyNoticeVersion: acceptance.privacyNoticeVersion,
    termsAcceptedAt: acceptance.acceptedAt,
    termsVersion: acceptance.termsVersion,
  }
}
