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

function localMidnightToUtc(date: CalendarDate, timeZone: string): Date {
  const desired = Date.UTC(date.year, date.month - 1, date.day)
  let candidate = new Date(desired)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = partsAt(candidate, timeZone)
    const represented = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second,
    )
    candidate = new Date(candidate.getTime() + desired - represented)
  }

  return candidate
}

export function getTodayWindow(now: Date, timeZone: string) {
  const today = calendarDateAt(now, timeZone)

  return {
    end: localMidnightToUtc(addCalendarDays(today, 1), timeZone),
    start: localMidnightToUtc(today, timeZone),
  }
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
  return {
    end: localMidnightToUtc(addCalendarDays(calendarDate, 1), timeZone),
    start: localMidnightToUtc(calendarDate, timeZone),
  }
}
