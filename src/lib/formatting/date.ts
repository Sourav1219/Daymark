/**
 * Centralized date/time formatting helpers.
 *
 * All display-facing date and time formatting in the application should go
 * through these helpers so that:
 *  1. Locale choices are consistent across the whole UI.
 *  2. It is straightforward to swap in a user-preference locale later.
 *
 * Current locale choices:
 *  - Dates:      "en-GB"  → "21 Aug 2026"  (unambiguous, no leading month)
 *  - Times:      "en-US"  → "2:30 PM"      (12-hour with AM/PM)
 *  - Date+Time:  combination of the two
 *  - Parts:      "en-US-u-ca-gregory-nu-latn" for Intl.formatToParts usage
 *                (Gregorian calendar, latin numerals — avoids locale-specific
 *                 numeral systems that make part extraction unpredictable)
 *
 * TODO: replace the hard-coded locale strings below with a user preference
 *       stored in user_settings.locale once that column is added.
 */

const DATE_LOCALE = "en-US"
const TIME_LOCALE = "en-US"
const PARTS_LOCALE = "en-US-u-ca-gregory-nu-latn"

/**
 * Formats a Date as a human-readable date label in the given timezone.
 * Example: "21 Aug 2026"
 */
export function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: timezone,
    year: "numeric",
  }).format(date)
}

/**
 * Formats a Date as a time string in the given timezone.
 * Example: "2:30 PM"
 */
export function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat(TIME_LOCALE, {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    timeZone: timezone,
  }).format(date)
}

/**
 * Formats a Date as "21 Aug 2026 at 2:30 PM" in the given timezone.
 */
export function formatDateTime(date: Date, timezone: string): string {
  return `${formatDate(date, timezone)} at ${formatTime(date, timezone)}`
}

/**
 * Formats a Date as a long date: "21 August 2026"
 */
export function formatDateLong(date: Date, timezone?: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: "numeric",
    month: "long",
    ...(timezone ? { timeZone: timezone } : {}),
    year: "numeric",
  }).format(date)
}

/**
 * Returns a record of Intl format parts (hour, minute, dayPeriod, day, month,
 * year, etc.) for the given Date and timezone. Useful when you need individual
 * parts rather than a pre-formatted string.
 *
 * Uses PARTS_LOCALE to guarantee Gregorian calendar and latin numerals.
 */
export function formatDateTimeParts(
  date: Date,
  timezone: string,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone"> = {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    year: "numeric",
  },
): Record<string, string> {
  return new Intl.DateTimeFormat(PARTS_LOCALE, {
    ...options,
    timeZone: timezone,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value
      return parts
    }, {})
}

/**
 * Formats a local ISO date string ("2026-08-21") as a human-readable label.
 * Interprets the date at noon UTC to avoid timezone-shifting the date itself.
 * Example: "21 Aug 2026"
 */
export function formatLocalDate(localDate: string): string {
  return formatDateLong(new Date(`${localDate}T12:00:00Z`))
}

/**
 * Formats a time string as "10:30:45 AM".
 */
export function formatTimeFull(date: Date, timezone: string): string {
  const parts = formatDateTimeParts(date, timezone, {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    second: "2-digit",
  })
  const period = (parts.dayPeriod ?? "").toUpperCase()
  return `${parts.hour}:${parts.minute}:${parts.second} ${period}`
}
