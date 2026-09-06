import { describe, expect, it } from "vitest"

import {
  canRestoreTrashedTask,
  canUseRestorationTimeline,
} from "@/features/quests/domain/trash-recovery"

describe("trash recovery day", () => {
  it("allows restoration later on the deletion day", () => {
    expect(
      canRestoreTrashedTask(
        "2026-09-06T09:00:00.000Z",
        "2026-09-06T21:00:00.000Z",
        "UTC",
      ),
    ).toBe(true)
  })

  it("rejects restoration after the local deletion day ends", () => {
    expect(
      canRestoreTrashedTask(
        "2026-09-06T17:30:00.000Z",
        "2026-09-06T18:31:00.000Z",
        "Asia/Kolkata",
      ),
    ).toBe(false)
  })

  it("uses the workspace day even when the UTC date changes", () => {
    expect(
      canRestoreTrashedTask(
        "2026-09-06T18:45:00.000Z",
        "2026-09-07T17:30:00.000Z",
        "Asia/Kolkata",
      ),
    ).toBe(true)
  })

  it("rejects missing, invalid, and pre-deletion restore instants", () => {
    expect(canRestoreTrashedTask(null, new Date(), "UTC")).toBe(false)
    expect(canRestoreTrashedTask("invalid", new Date(), "UTC")).toBe(false)
    expect(
      canRestoreTrashedTask(
        "2026-09-06T09:00:00.000Z",
        "2026-09-06T08:59:59.999Z",
        "UTC",
      ),
    ).toBe(false)
  })

  it("keeps a restoration timeline between now and local midnight", () => {
    const restoredAt = new Date("2026-09-06T16:00:00.000Z")

    expect(
      canUseRestorationTimeline(
        new Date("2026-09-06T16:30:00.000Z"),
        new Date("2026-09-06T18:29:00.000Z"),
        restoredAt,
        "Asia/Kolkata",
      ),
    ).toBe(true)
    expect(
      canUseRestorationTimeline(
        new Date("2026-09-06T16:30:00.000Z"),
        new Date("2026-09-06T18:30:00.000Z"),
        restoredAt,
        "Asia/Kolkata",
      ),
    ).toBe(false)
  })

  it("requires a future start and a later due time", () => {
    const restoredAt = new Date("2026-09-06T09:00:00.000Z")

    expect(
      canUseRestorationTimeline(
        restoredAt,
        new Date("2026-09-06T10:00:00.000Z"),
        restoredAt,
        "UTC",
      ),
    ).toBe(false)
    expect(
      canUseRestorationTimeline(
        new Date("2026-09-06T10:00:00.000Z"),
        new Date("2026-09-06T10:00:00.000Z"),
        restoredAt,
        "UTC",
      ),
    ).toBe(false)
  })
})
