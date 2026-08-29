type CalendarDate = Readonly<{
  day: number
  month: number
  year: number
}>

const calendarDateFormatter = new Map<string, Intl.DateTimeFormat>()
const dateTimeFormatter = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timeZone: string, includeTime: boolean) {
  const cache = includeTime ? dateTimeFormatter : calendarDateFormatter
  const cached = cache.get(timeZone)

  if (cached) {
    return cached
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: includeTime ? "2-digit" : undefined,
    hour12: false,
    minute: includeTime ? "2-digit" : undefined,
    month: "2-digit",
    second: includeTime ? "2-digit" : undefined,
    timeZone,
    year: "numeric",
  })
  cache.set(timeZone, formatter)

  return formatter
}

function partsAt(instant: Date, timeZone: string) {
  const parts = getFormatter(timeZone, true).formatToParts(instant)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  )

  return {
    day: values.day ?? 1,
    hour: values.hour === 24 ? 0 : (values.hour ?? 0),
    minute: values.minute ?? 0,
    month: values.month ?? 1,
    second: values.second ?? 0,
    year: values.year ?? 1970,
  }
}

function calendarDateAt(instant: Date, timeZone: string): CalendarDate {
  const values = partsAt(instant, timeZone)

  return { day: values.day, month: values.month, year: values.year }
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days))

  return {
    day: next.getUTCDate(),
    month: next.getUTCMonth() + 1,
    year: next.getUTCFullYear(),
  }
}

function calendarDateValue(date: CalendarDate) {
  return Date.UTC(date.year, date.month - 1, date.day)
}

/** Finds the first instant represented by a local calendar day. */
function localMidnightToUtc(date: CalendarDate, timeZone: string): Date | null {
  const desired = calendarDateValue(date)
  const searchRadiusMs = 36 * 60 * 60 * 1_000
  let lower = desired - searchRadiusMs
  let upper = desired + searchRadiusMs

  // Calendar dates are monotonic even across offset changes. Searching for
  // the first instant whose represented date is at least the requested date
  // handles midnight gaps and overlaps without a fixed-point oscillation.
  while (lower < upper) {
    const midpoint = lower + Math.floor((upper - lower) / 2)
    const represented = calendarDateValue(
      calendarDateAt(new Date(midpoint), timeZone),
    )
    if (represented < desired) lower = midpoint + 1
    else upper = midpoint
  }

  const candidate = new Date(lower)
  return calendarDateValue(calendarDateAt(candidate, timeZone)) === desired
    ? candidate
    : null
}

export function getTodayWindow(now: Date, timeZone: string) {
  const today = calendarDateAt(now, timeZone)
  const start = localMidnightToUtc(today, timeZone)
  const end = localMidnightToUtc(addCalendarDays(today, 1), timeZone)

  if (!start || !end) {
    throw new RangeError("The current local day could not be resolved.")
  }

  return { end, start }
}

export function getLocalDayWindow(localDate: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(localDate)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null
  }

  const calendarDate = { day, month, year }
  const start = localMidnightToUtc(calendarDate, timeZone)
  const end = localMidnightToUtc(addCalendarDays(calendarDate, 1), timeZone)

  return start && end ? { end, start } : null
}

export function resolveTodayDate(
  requestedDate: string | undefined,
  todayDate: string,
  timeZone: string,
) {
  return requestedDate &&
    requestedDate <= todayDate &&
    getLocalDayWindow(requestedDate, timeZone)
    ? requestedDate
    : todayDate
}
