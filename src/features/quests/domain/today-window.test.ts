import { describe, expect, it } from "vitest"

import {
  getLocalDayWindow,
  getTodayWindow,
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
})
