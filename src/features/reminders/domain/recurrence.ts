import { DateTime } from "luxon"
import { datetime, RRule } from "rrule"

import { isValidTimezone } from "@/features/reminders/domain/timezone"

const supportedFrequencies = new Set([
  RRule.DAILY,
  RRule.WEEKLY,
  RRule.MONTHLY,
  RRule.YEARLY,
])

export class RecurrenceRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RecurrenceRuleError"
  }
}

function floatingDate(value: DateTime): Date {
  return datetime(
    value.year,
    value.month,
    value.day,
    value.hour,
    value.minute,
    value.second,
  )
}

function asZonedFloating(instant: Date, timezone: string): Date {
  return floatingDate(
    DateTime.fromJSDate(instant, { zone: "utc" }).setZone(timezone),
  )
}

function floatingToInstant(value: Date, timezone: string): Date {
  const requested = {
    day: value.getUTCDate(),
    hour: value.getUTCHours(),
    millisecond: value.getUTCMilliseconds(),
    minute: value.getUTCMinutes(),
    month: value.getUTCMonth() + 1,
    second: value.getUTCSeconds(),
    year: value.getUTCFullYear(),
  }
  const zoned = DateTime.fromObject(requested, { zone: timezone })

  // Luxon normalizes spring-forward gaps (for example 02:30 to 03:30)
  // instead of marking them invalid. Round-trip every wall-clock component so
  // recurrence generation never silently changes the requested local time.
  if (
    !zoned.isValid ||
    zoned.year !== requested.year ||
    zoned.month !== requested.month ||
    zoned.day !== requested.day ||
    zoned.hour !== requested.hour ||
    zoned.minute !== requested.minute ||
    zoned.second !== requested.second ||
    zoned.millisecond !== requested.millisecond
  ) {
    throw new RecurrenceRuleError(
      "The recurrence falls on an invalid local time.",
    )
  }

  return zoned.toUTC().toJSDate()
}

export function normalizeRecurrenceRule(input: string): string {
  const value = input.trim().toUpperCase()

  if (!value) return ""
  if (value.length > 512 || /[\r\n]/u.test(value)) {
    throw new RecurrenceRuleError(
      "Use one RRULE line of 512 characters or fewer.",
    )
  }

  const ruleText = value.startsWith("RRULE:") ? value.slice(6) : value

  try {
    const options = RRule.parseString(ruleText)

    if (options.freq === undefined || !supportedFrequencies.has(options.freq)) {
      throw new RecurrenceRuleError(
        "Recurring tasks support daily, weekly, monthly, or yearly rules.",
      )
    }

    if (
      options.count !== null &&
      options.count !== undefined &&
      options.count > 10_000
    ) {
      throw new RecurrenceRuleError("A recurrence COUNT cannot exceed 10,000.")
    }

    return new RRule(options).toString()
  } catch (error) {
    if (error instanceof RecurrenceRuleError) throw error
    throw new RecurrenceRuleError("Enter a valid RFC 5545 recurrence rule.")
  }
}

export function calculateNextOccurrence(
  recurrenceRule: string,
  timezone: string,
  anchor: Date,
  after: Date = anchor,
): Date | null {
  if (!isValidTimezone(timezone)) {
    throw new RecurrenceRuleError("Choose a valid IANA timezone.")
  }

  const normalized = normalizeRecurrenceRule(recurrenceRule)
  if (!normalized) return null

  const parsed = RRule.parseString(normalized.replace(/^RRULE:/u, ""))
  const rule = new RRule({
    ...parsed,
    dtstart: asZonedFloating(anchor, timezone),
    tzid: null,
    until: parsed.until ? asZonedFloating(parsed.until, timezone) : null,
  })
  let next = rule.after(asZonedFloating(after, timezone), false)
  while (next) {
    try {
      return floatingToInstant(next, timezone)
    } catch (error) {
      if (!(error instanceof RecurrenceRuleError)) throw error
      // A spring-forward gap has no corresponding instant. Consume only that
      // occurrence and ask the floating rule for the next wall-clock value;
      // this preserves the configured hour instead of shifting the series.
      next = rule.after(next, false)
    }
  }

  return null
}
