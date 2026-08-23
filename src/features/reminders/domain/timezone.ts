import { DateTime } from "luxon"

/**
 * Zone every new workspace and user starts on. Keep this in sync with the
 * `timezone` column defaults in the workspaces and user_settings schemas.
 */
export const defaultTimezone = "UTC"

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format()
    return true
  } catch {
    return false
  }
}

/**
 * Short label for a zone, for badges and field labels: "IST", "UTC", "GMT-4".
 * en-IN is used deliberately so India Standard Time reads as "IST" instead of
 * the "GMT+5:30" that en-US produces. Falls back to the IANA name.
 */
export function timezoneAbbreviation(timezone: string): string {
  if (!isValidTimezone(timezone)) return timezone

  const label = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    timeZoneName: "short",
  })
    .formatToParts(new Date())
    .find(({ type }) => type === "timeZoneName")?.value

  return label ?? timezone
}

export function parseZonedLocalDateTime(
  value: string,
  timezone: string,
): Date | null {
  if (!isValidTimezone(timezone)) return null

  const parsed = DateTime.fromFormat(value, "yyyy-MM-dd'T'HH:mm", {
    locale: "en",
    setZone: true,
    zone: timezone,
  })

  return parsed.isValid && parsed.toFormat("yyyy-MM-dd'T'HH:mm") === value
    ? parsed.toUTC().toJSDate()
    : null
}

export function formatZonedLocalInput(
  value: string | Date | null | undefined,
  timezone: string,
): string {
  if (!value) return ""
  const instant = typeof value === "string" ? new Date(value) : value

  return DateTime.fromJSDate(instant, { zone: "utc" })
    .setZone(timezone)
    .toFormat("yyyy-MM-dd'T'HH:mm")
}

export function formatZonedDateTime(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: timezone,
    timeZoneName: "short",
    year: "numeric",
  }).format(value)
}
