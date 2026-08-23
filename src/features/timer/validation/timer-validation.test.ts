import { describe, expect, it } from "vitest"

import {
  createGroupStudySchema,
  editTimerSubjectSchema,
  joinGroupStudySchema,
  startTimerSchema,
  timerTransitionSchema,
} from "@/features/timer/validation/timer-validation"

describe("timer validation", () => {
  it("normalizes active Group Study join codes", () => {
    expect(joinGroupStudySchema.parse({ joinCode: " 23abcdef " })).toEqual({
      joinCode: "23ABCDEF",
    })
  })

  it("validates Group Study room details and participant limits", () => {
    expect(
      createGroupStudySchema.parse({
        name: "  Finals room  ",
        participantLimit: "6",
        subject: "  Physics revision  ",
      }),
    ).toEqual({
      name: "Finals room",
      participantLimit: 6,
      subject: "Physics revision",
    })
    expect(
      createGroupStudySchema.safeParse({
        name: "Room",
        participantLimit: 21,
        subject: "Physics",
      }).success,
    ).toBe(false)
  })
  it("normalizes a bounded subject", () => {
    expect(startTimerSchema.parse({ subject: "  Calculus  " })).toEqual({
      subject: "Calculus",
    })
  })

  it("rejects empty and oversized subjects", () => {
    expect(startTimerSchema.safeParse({ subject: "   " }).success).toBe(false)
    expect(
      startTimerSchema.safeParse({ subject: "x".repeat(161) }).success,
    ).toBe(false)
  })

  it("requires a versioned UUID for transitions and edits", () => {
    const transition = {
      expectedVersion: 2,
      sessionId: "a8fdce72-19a7-4544-b863-50caa19373e7",
    }
    expect(timerTransitionSchema.safeParse(transition).success).toBe(true)
    expect(
      editTimerSubjectSchema.safeParse({ ...transition, subject: "Reading" })
        .success,
    ).toBe(true)
    expect(
      timerTransitionSchema.safeParse({ ...transition, expectedVersion: 0 })
        .success,
    ).toBe(false)
  })
})
