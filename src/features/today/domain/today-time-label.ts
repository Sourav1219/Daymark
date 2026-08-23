import { formatDate, formatTime } from "@/lib/formatting/date"

export type TodayScheduleLabel = Readonly<{
  dateLabel: string
  timeLabel: string
}>

function calendarKey(date: Date, timeZone: string): string {
  // ISO date key (YYYY-MM-DD) for same-day comparison — locale-independent.
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(date)
}

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    year: "numeric",
  }).formatToParts(date)

  return {
    day: parts.find(({ type }) => type === "day")?.value ?? "",
    month: parts.find(({ type }) => type === "month")?.value ?? "",
    year: parts.find(({ type }) => type === "year")?.value ?? "",
  }
}

function formatDateRange(start: Date, due: Date, timeZone: string) {
  const startDate = dateParts(start, timeZone)
  const dueDate = dateParts(due, timeZone)

  if (startDate.year !== dueDate.year) {
    return `${formatDate(start, timeZone)} → ${formatDate(due, timeZone)}`
  }

  if (startDate.month !== dueDate.month) {
    return `${startDate.month} ${startDate.day}–${dueDate.month} ${dueDate.day}`
  }

  return `${startDate.month} ${startDate.day}–${dueDate.day}`
}

export function formatTodaySchedule(
  startAt: string | null,
  dueAt: string | null,
  timeZone: string,
): TodayScheduleLabel {
  const start = startAt ? new Date(startAt) : null
  const due = dueAt ? new Date(dueAt) : null

  if (start && due) {
    const sameDate = calendarKey(start, timeZone) === calendarKey(due, timeZone)

    return {
      dateLabel: sameDate
        ? formatDate(start, timeZone)
        : formatDateRange(start, due, timeZone),
      timeLabel: `${formatTime(start, timeZone)} – ${formatTime(due, timeZone)}`,
    }
  }

  if (due) {
    return {
      dateLabel: formatDate(due, timeZone),
      timeLabel: `Due ${formatTime(due, timeZone)}`,
    }
  }

  if (start) {
    return {
      dateLabel: formatDate(start, timeZone),
      timeLabel: `Starts ${formatTime(start, timeZone)}`,
    }
  }

  return { dateLabel: "No fixed date", timeLabel: "Anytime" }
}
