export const cookieConsentName = "traketo_cookie_consent"
export const cookieConsentMaxAgeSeconds = 180 * 24 * 60 * 60

export const cookieConsentValues = {
  essential: "v1.essential",
  preferences: "v1.preferences",
} as const

export type CookieConsent = keyof typeof cookieConsentValues

export function parseCookieConsent(
  value: string | null | undefined,
): CookieConsent | null {
  if (value === cookieConsentValues.essential) return "essential"
  if (value === cookieConsentValues.preferences) return "preferences"
  return null
}
