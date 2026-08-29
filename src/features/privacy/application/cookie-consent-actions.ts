"use server"

import { cookies } from "next/headers"
import { z } from "zod"

import {
  cookieConsentMaxAgeSeconds,
  cookieConsentName,
  cookieConsentValues,
  type CookieConsent,
} from "@/features/privacy/domain/cookie-consent"

const cookieConsentSchema = z.enum(["essential", "preferences"])

export async function saveCookieConsentAction(
  requestedConsent: unknown,
): Promise<CookieConsent | null> {
  // Server Actions are public RPC endpoints, so caller input is untrusted.
  // Return a non-throwing rejection for malformed calls. Persisting a default
  // the caller never chose would record a consent decision that was not made.
  const parsed = cookieConsentSchema.safeParse(requestedConsent)
  if (!parsed.success) {
    return null
  }

  const consent = parsed.data
  const cookieStore = await cookies()

  cookieStore.set(cookieConsentName, cookieConsentValues[consent], {
    httpOnly: false,
    maxAge: cookieConsentMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  return consent
}
