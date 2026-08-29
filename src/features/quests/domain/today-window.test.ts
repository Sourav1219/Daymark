import { describe, expect, it } from "vitest"

import {
  getLocalDayWindow,
  getTodayWindow,
  resolveTodayDate,
} from "@/features/quests/domain/today-window"

describe("workspace Today window", () => {
  it("returns UTC calendar boundaries", () => {
    const window = getTodayWindow(new Date("2026-08-08T15:30:00.000Z"), "UTC")

    expect(window.start.toISOString()).toBe("2026-08-08T00:00:00.000Z")
    expect(window.end.toISOString()).toBe("2026-08-09T00:00:00.000Z")
  })

  it("honors timezone offsets and daylight-saving day length", () => {
    const normalDay = getTodayWindow(
      new Date("2026-08-08T15:30:00.000Z"),
      "Asia/Kolkata",
    )
    expect(normalDay.start.toISOString()).toBe("2026-08-07T18:30:00.000Z")
    expect(normalDay.end.toISOString()).toBe("2026-08-08T18:30:00.000Z")

    const springForward = getTodayWindow(
      new Date("2026-03-08T16:00:00.000Z"),
      "America/New_York",
    )
    expect(springForward.start.toISOString()).toBe("2026-03-08T05:00:00.000Z")
    expect(springForward.end.toISOString()).toBe("2026-03-09T04:00:00.000Z")
  })

  it("builds an exact window for a selected calendar date", () => {
    const window = getLocalDayWindow("2026-08-13", "Asia/Kolkata")

    expect(window?.start.toISOString()).toBe("2026-08-12T18:30:00.000Z")
    expect(window?.end.toISOString()).toBe("2026-08-13T18:30:00.000Z")
    expect(getLocalDayWindow("2026-02-31", "UTC")).toBeNull()
  })

  it("resolves midnight timezone transitions without oscillating", () => {
    const window = getLocalDayWindow("2026-09-06", "America/Santiago")

    expect(window?.start.toISOString()).toBe("2026-09-06T04:00:00.000Z")
    expect(window?.end.toISOString()).toBe("2026-09-07T03:00:00.000Z")
  })

  it("never selects a future date for Today", () => {
    expect(resolveTodayDate("2026-08-30", "2026-08-29", "Asia/Kolkata")).toBe(
      "2026-08-29",
    )
    expect(resolveTodayDate("2026-08-29", "2026-08-29", "Asia/Kolkata")).toBe(
      "2026-08-29",
    )
    expect(resolveTodayDate("2026-08-28", "2026-08-29", "Asia/Kolkata")).toBe(
      "2026-08-28",
    )
    expect(resolveTodayDate("not-a-date", "2026-08-29", "Asia/Kolkata")).toBe(
      "2026-08-29",
    )
  })
})
