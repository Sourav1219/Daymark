"use client"

import {
  cookieConsentName,
  parseCookieConsent,
} from "@/features/privacy/domain/cookie-consent"

export const cookieConsentChangedEvent = "traketo:cookie-consent-changed"
export const readDeadlineStorageKey = "questly:read-deadline-alerts"
export const todayPromoStorageKey = "questly-today-promo-dismissed"

const optionalStorageKeys = [
  readDeadlineStorageKey,
  todayPromoStorageKey,
] as const

function consentCookieValue(): string | null {
  if (typeof document === "undefined") return null

  for (const part of document.cookie.split(";")) {
    const [name, ...valueParts] = part.trim().split("=")
    if (name === cookieConsentName) {
      return decodeURIComponent(valueParts.join("="))
    }
  }

  return null
}

export function hasPreferenceStorageConsent(): boolean {
  return parseCookieConsent(consentCookieValue()) === "preferences"
}

export function clearOptionalBrowserStorage(): void {
  for (const key of optionalStorageKeys) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Consent withdrawal still succeeds when storage is unavailable.
    }
  }
}
