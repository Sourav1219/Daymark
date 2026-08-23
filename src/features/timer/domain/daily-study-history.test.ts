import { describe, expect, it } from "vitest"

import { summarizeDailyStudy } from "./daily-study-history"

describe("daily timer study summaries", () => {
  it("combines solo and shared timer rows by their local completion date", () => {
    // All three sessions are entirely within Aug 20 IST (UTC+5:30).
    // IST midnight = 2026-08-19T18:30:00Z → 2026-08-20T18:30:00Z
    // Session 1: 03:30Z→04:30Z  = 09:00–10:00 IST Aug 20 ✓
    // Session 2: 10:00Z→10:30Z  = 15:30–16:00 IST Aug 20 ✓
    // Session 3: 11:00Z→11:15Z  = 16:30–16:45 IST Aug 20 ✓
    // Running session (no endedAt) should be ignored.
    const summaries = summarizeDailyStudy(
      [
        {
          accumulatedMs: 3_600_000,
          endedAt: new Date("2026-08-20T04:30:00.000Z"),
          startedAt: new Date("2026-08-20T03:30:00.000Z"),
          status: "completed",
        },
        {
          accumulatedMs: 1_800_000,
          endedAt: new Date("2026-08-20T10:30:00.000Z"),
          startedAt: new Date("2026-08-20T10:00:00.000Z"),
          status: "completed",
        },
        {
          accumulatedMs: 900_000,
          endedAt: new Date("2026-08-20T11:15:00.000Z"),
          startedAt: new Date("2026-08-20T11:00:00.000Z"),
          status: "completed",
        },
        {
          accumulatedMs: 99_000,
          endedAt: null,
          startedAt: new Date("2026-08-20T11:30:00.000Z"),
          status: "running",
        },
      ],
      "Asia/Kolkata",
    )

    expect(summaries).toEqual([
      { localDate: "2026-08-20", sessionCount: 3, totalMs: 6_300_000 },
    ])
  })

  it("splits a cross-midnight session across two local days proportionally", () => {
    // Session: 11:50 PM to 12:20 AM local (Asia/Kolkata = UTC+5:30)
    // Local midnight = 2026-08-20T18:30:00Z
    // Start: 2026-08-20T18:20:00Z  (11:50 PM IST Aug 20)
    // End:   2026-08-20T18:50:00Z  (12:20 AM IST Aug 21)
    // Wall-clock = 30 min. 10 min before midnight → 20 min after.
    // accumulatedMs = 1_800_000 (30 min, timer never paused)
    // Expected split: Aug 20 gets 10/30 × 1_800_000 = 600_000 ms
    //                 Aug 21 gets 20/30 × 1_800_000 = 1_200_000 ms
    const summaries = summarizeDailyStudy(
      [
        {
          accumulatedMs: 1_800_000,
          endedAt: new Date("2026-08-20T18:50:00.000Z"),
          startedAt: new Date("2026-08-20T18:20:00.000Z"),
          status: "completed",
        },
      ],
      "Asia/Kolkata",
    )

    expect(summaries).toHaveLength(2)
    const aug21 = summaries.find((s) => s.localDate === "2026-08-21")
    const aug20 = summaries.find((s) => s.localDate === "2026-08-20")

    expect(aug21).toBeDefined()
    expect(aug20).toBeDefined()
    // sessionCount is attributed to the ending day
    expect(aug21?.sessionCount).toBe(1)
    expect(aug20?.sessionCount).toBe(0)
    // Allow ±1 ms rounding tolerance
    expect(aug20?.totalMs).toBeCloseTo(600_000, -2)
    expect(aug21?.totalMs).toBeCloseTo(1_200_000, -2)
  })

  it("keeps a session that does not cross midnight on its single local day", () => {
    const summaries = summarizeDailyStudy(
      [
        {
          accumulatedMs: 3_600_000,
          endedAt: new Date("2026-08-21T10:00:00.000Z"),
          startedAt: new Date("2026-08-21T09:00:00.000Z"),
          status: "completed",
        },
      ],
      "UTC",
    )

    expect(summaries).toEqual([
      { localDate: "2026-08-21", sessionCount: 1, totalMs: 3_600_000 },
    ])
  })
})
