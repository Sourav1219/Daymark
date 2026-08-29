import { describe, expect, it } from "vitest"

import {
  calculateNextOccurrence,
  normalizeRecurrenceRule,
} from "@/features/reminders/domain/recurrence"
import { parseZonedLocalDateTime } from "@/features/reminders/domain/timezone"

describe("RFC 5545 recurrence calculations", () => {
  it("normalizes supported rules and rejects unsafe high-frequency rules", () => {
    expect(normalizeRecurrenceRule("freq=weekly;byday=mo,we,fr")).toBe(
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
    )
    expect(() => normalizeRecurrenceRule("RRULE:FREQ=HOURLY")).toThrow(
      "daily, weekly, monthly, or yearly",
    )
    expect(() =>
      normalizeRecurrenceRule("RRULE:FREQ=DAILY\nRDATE:20260809T090000Z"),
    ).toThrow("one RRULE line")
  })

  it("keeps the local hour across the spring daylight-saving transition", () => {
    const anchor = new Date("2026-03-07T14:00:00.000Z") // 09:00 EST
    const next = calculateNextOccurrence(
      "RRULE:FREQ=DAILY",
      "America/New_York",
      anchor,
    )

    expect(next?.toISOString()).toBe("2026-03-08T13:00:00.000Z") // 09:00 EDT
  })

  it("keeps the local hour across the autumn daylight-saving transition", () => {
    const anchor = new Date("2026-10-31T13:00:00.000Z") // 09:00 EDT
    const next = calculateNextOccurrence(
      "RRULE:FREQ=DAILY",
      "America/New_York",
      anchor,
    )

    expect(next?.toISOString()).toBe("2026-11-01T14:00:00.000Z") // 09:00 EST
  })

  it("handles monthly BYDAY rules and finite COUNT limits", () => {
    const anchor = new Date("2026-01-05T09:00:00.000Z")

    expect(
      calculateNextOccurrence(
        "RRULE:FREQ=MONTHLY;BYDAY=1MO",
        "UTC",
        anchor,
      )?.toISOString(),
    ).toBe("2026-02-02T09:00:00.000Z")
    expect(
      calculateNextOccurrence("RRULE:FREQ=DAILY;COUNT=1", "UTC", anchor),
    ).toBeNull()
  })

  it("rejects nonexistent local wall times during the DST jump", () => {
    expect(
      parseZonedLocalDateTime("2026-03-08T02:30", "America/New_York"),
    ).toBeNull()
    expect(
      parseZonedLocalDateTime(
        "2026-03-08T03:30",
        "America/New_York",
      )?.toISOString(),
    ).toBe("2026-03-08T07:30:00.000Z")

    expect(
      calculateNextOccurrence(
        "RRULE:FREQ=DAILY",
        "America/New_York",
        new Date("2026-03-07T07:30:00.000Z"),
      )?.toISOString(),
    ).toBe("2026-03-09T06:30:00.000Z")
  })
})
