export const registrationTermsVersion = "2026-08-28"
export const registrationPrivacyNoticeVersion = "2026-08-28"
export const registrationAgeRequirementVersion = "2026-09-10"

export const registrationAcceptanceHeaderName =
  "x-traketo-registration-acceptance"
export const registrationAcceptanceCookieName =
  "traketo_registration_acceptance"

export type RegistrationSource = "email" | "google"

export type RegistrationAcceptance = Readonly<{
  acceptedAt: Date
  ageRequirementVersion: string
  privacyNoticeVersion: string
  source: RegistrationSource
  termsVersion: string
}>
