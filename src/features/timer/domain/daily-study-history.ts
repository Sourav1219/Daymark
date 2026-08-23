import { DateTime } from "luxon"

export type DailyStudySummary = Readonly<{
  localDate: string
  sessionCount: number
  totalMs: number
}>

type CompletedTimerRecord = Readonly<{
  accumulatedMs: number
  startedAt: Date
  endedAt: Date | null
  status: string
}>

function localDateForTimer(instant: Date, timezone: string) {
  return DateTime.fromJSDate(instant, { zone: "utc" })
    .setZone(timezone)
    .toISODate()
}

export function summarizeDailyStudy(
  records: readonly CompletedTimerRecord[],
  timezone: string,
): readonly DailyStudySummary[] {
  const daily = new Map<string, { sessionCount: number; totalMs: number }>()

  for (const record of records) {
    if (record.status !== "completed" || !record.endedAt) continue

    // Parse both instants from UTC (database stores UTC timestamps).
    const start = DateTime.fromJSDate(record.startedAt, {
      zone: "utc",
    }).setZone(timezone)
    const end = DateTime.fromJSDate(record.endedAt, { zone: "utc" }).setZone(
      timezone,
    )

    const duration = end.diff(start).as("milliseconds")
    if (duration <= 0) continue

    // The day the session ended — this is where sessionCount is counted.
    const endLocalDate = end.toISODate()

    let current = start.startOf("day")
    while (current < end) {
      const dayEnd = current.endOf("day")
      const segmentEnd = dayEnd < end ? dayEnd : end

      const segmentStart = current > start ? current : start
      const segmentMs = segmentEnd.diff(segmentStart).as("milliseconds")

      const localDate = current.toISODate()
      if (!localDate || segmentMs <= 0) {
        current = dayEnd.plus({ millisecond: 1 }).startOf("day")
        continue
      }

      const entry = daily.get(localDate) ?? { sessionCount: 0, totalMs: 0 }
      entry.totalMs += segmentMs
      // sessionCount is attributed to the day the session ended.
      if (localDate === endLocalDate) {
        entry.sessionCount += 1
      }
      daily.set(localDate, entry)

      current = dayEnd.plus({ millisecond: 1 }).startOf("day")
    }
  }

  return [...daily.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([localDate, summary]) => ({
      localDate,
      sessionCount: summary.sessionCount,
      totalMs: Math.round(summary.totalMs),
    }))
}

export function isTimerRecordOnLocalDate(
  endedAt: Date | null,
  localDate: string,
  timezone: string,
) {
  return Boolean(endedAt && localDateForTimer(endedAt, timezone) === localDate)
}
