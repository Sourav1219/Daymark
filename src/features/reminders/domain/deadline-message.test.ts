import { describe, expect, it } from "vitest"

import { deadlineMessage } from "@/features/reminders/domain/deadline-message"

const now = new Date("2026-08-14T06:30:00.000Z").getTime()

describe("deadlineMessage", () => {
  it("describes near deadlines in whole minutes", () => {
    expect(deadlineMessage("2026-08-14T06:42:10.000Z", now)).toBe(
      "Ends in 13 minutes.",
    )
    expect(deadlineMessage("2026-08-14T06:30:30.000Z", now)).toBe(
      "Ends in less than a minute.",
    )
  })

  it("keeps longer alerts precise without exposing raw timestamps", () => {
    expect(deadlineMessage("2026-08-14T08:35:00.000Z", now)).toBe(
      "Ends in 2 hours 5 minutes.",
    )
  })

  it("handles a deadline passing while the inbox is open", () => {
    expect(deadlineMessage("2026-08-14T06:29:59.000Z", now)).toBe(
      "The deadline has passed.",
    )
  })
})
