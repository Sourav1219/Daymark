import { describe, expect, it } from "vitest"

import { formatTodaySchedule } from "./today-time-label"

describe("formatTodaySchedule", () => {
  const timeZone = "Asia/Kolkata"

  it("shows a compact date range for an overnight deadline", () => {
    expect(
      formatTodaySchedule(
        "2026-08-13T17:30:00.000Z",
        "2026-08-13T19:30:00.000Z",
        timeZone,
      ),
    ).toEqual({
      dateLabel: "Aug 13–14",
      timeLabel: "11:00 PM – 1:00 AM",
    })
  })

  it("keeps both months in a compact cross-month range", () => {
    expect(
      formatTodaySchedule(
        "2026-08-31T17:30:00.000Z",
        "2026-08-31T19:30:00.000Z",
        timeZone,
      ),
    ).toEqual({
      dateLabel: "Aug 31–Sep 1",
      timeLabel: "11:00 PM – 1:00 AM",
    })
  })

  it("shows one absolute date for a same-day window", () => {
    expect(
      formatTodaySchedule(
        "2026-08-13T09:15:00.000Z",
        "2026-08-13T11:15:00.000Z",
        timeZone,
      ),
    ).toEqual({
      dateLabel: "Aug 13, 2026",
      timeLabel: "2:45 PM – 4:45 PM",
    })
  })

  it("shows an absolute date for a due-only task", () => {
    expect(
      formatTodaySchedule(null, "2026-08-14T17:25:00.000Z", timeZone),
    ).toEqual({
      dateLabel: "Aug 14, 2026",
      timeLabel: "Due 10:55 PM",
    })
  })
})
