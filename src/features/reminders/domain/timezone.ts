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

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value)
  if (!match) return null

  const requested = {
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    month: Number(match[2]),
    year: Number(match[1]),
  }
  const nominalUtc = Date.UTC(
    requested.year,
    requested.month - 1,
    requested.day,
    requested.hour,
    requested.minute,
  )
  const nominal = new Date(nominalUtc)
  if (
    nominal.getUTCFullYear() !== requested.year ||
    nominal.getUTCMonth() + 1 !== requested.month ||
    nominal.getUTCDate() !== requested.day ||
    requested.hour > 23 ||
    requested.minute > 59
  ) {
    return null
  }

  // Resolve the zone offset as a fixed point. The final round-trip rejects
  // spring-forward gaps instead of silently normalising them.
  let candidate = nominalUtc
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = zonedParts(new Date(candidate), timezone)
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    )
    const next = nominalUtc - (representedUtc - candidate)
    if (next === candidate) break
    candidate = next
  }

  const roundTrip = zonedParts(new Date(candidate), timezone)
  return roundTrip.year === requested.year &&
    roundTrip.month === requested.month &&
    roundTrip.day === requested.day &&
    roundTrip.hour === requested.hour &&
    roundTrip.minute === requested.minute
    ? new Date(candidate)
    : null
}

const zonedPartsFormatters = new Map<string, Intl.DateTimeFormat>()

function zonedParts(instant: Date, timezone: string) {
  let formatter = zonedPartsFormatters.get(timezone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    })
    zonedPartsFormatters.set(timezone, formatter)
  }
  const values = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  )
  return {
    day: values.day ?? 1,
    hour: values.hour === 24 ? 0 : (values.hour ?? 0),
    minute: values.minute ?? 0,
    month: values.month ?? 1,
    year: values.year ?? 1970,
  }
}

export function formatZonedLocalInput(
  value: string | Date | null | undefined,
  timezone: string,
): string {
  if (!value) return ""
  const instant = typeof value === "string" ? new Date(value) : value

  const parts = zonedParts(instant, timezone)
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
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
