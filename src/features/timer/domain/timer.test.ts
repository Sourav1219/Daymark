import { describe, expect, it } from "vitest"

import { calculateTimerElapsedMs } from "@/features/timer/domain/timer"

describe("calculateTimerElapsedMs", () => {
  it("uses timestamps so background throttling cannot lose elapsed time", () => {
    expect(
      calculateTimerElapsedMs({
        accumulatedMs: 5_000,
        lastStartedAt: "2026-08-20T10:00:00.000Z",
        nowMs: Date.parse("2026-08-20T10:02:00.000Z"),
        status: "running",
      }),
    ).toBe(125_000)
  })

  it("preserves the exact accumulated point while paused", () => {
    expect(
      calculateTimerElapsedMs({
        accumulatedMs: 125_000,
        lastStartedAt: null,
        nowMs: Date.parse("2026-08-20T11:00:00.000Z"),
        status: "paused",
      }),
    ).toBe(125_000)
  })

  it("adds only the current running segment after a timer is resumed", () => {
    expect(
      calculateTimerElapsedMs({
        accumulatedMs: 125_000,
        lastStartedAt: "2026-08-20T11:00:00.000Z",
        nowMs: Date.parse("2026-08-20T11:02:00.000Z"),
        status: "running",
      }),
    ).toBe(245_000)
  })
})
