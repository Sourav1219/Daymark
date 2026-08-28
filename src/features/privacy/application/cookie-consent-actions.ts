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
  requestedConsent: CookieConsent,
): Promise<CookieConsent> {
  const consent = cookieConsentSchema.parse(requestedConsent)
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
