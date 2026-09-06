import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  createQuestSchema,
  editQuestSchema,
  editQuestScheduleSchema,
  parseCreateQuestForm,
  parseEditQuestForm,
  parseEditQuestSchedule,
  parseRestoreQuestSchedule,
  questReorderSchema,
  questTransitionSchema,
} from "@/features/quests/validation/quest-validation"

const validQuest = {
  description: "Prepare a bounded implementation.",
  dueAt: "2026-08-08T13:30",
  priority: "high",
  startAt: "2026-08-08T09:00",
  title: "Ship the Quest loop",
}

describe("Quest validation", () => {
  it("normalizes a valid create command into UTC dates", () => {
    const result = createQuestSchema.parse(validQuest)

    expect(result).toMatchObject({
      description: validQuest.description,
      priority: "high",
      title: validQuest.title,
    })
    expect(result.startAt?.toISOString()).toBe("2026-08-08T09:00:00.000Z")
    expect(result.dueAt?.toISOString()).toBe("2026-08-08T13:30:00.000Z")
  })

  it("rejects blank and oversized titles", () => {
    expect(
      createQuestSchema.safeParse({ ...validQuest, title: "   " }).success,
    ).toBe(false)
    expect(
      createQuestSchema.safeParse({ ...validQuest, title: "x".repeat(161) })
        .success,
    ).toBe(false)
  })

  it("rejects invalid priorities, calendar dates, and reversed schedules", () => {
    expect(
      createQuestSchema.safeParse({ ...validQuest, priority: "legendary" })
        .success,
    ).toBe(false)
    expect(
      createQuestSchema.safeParse({
        ...validQuest,
        dueAt: "2026-02-31T13:30",
      }).success,
    ).toBe(false)

    const reversed = createQuestSchema.safeParse({
      ...validQuest,
      dueAt: "2026-08-08T08:59",
    })
    expect(reversed.success).toBe(false)
    expect(
      reversed.success ? [] : reversed.error.flatten().fieldErrors.dueAt,
    ).toContain("Due time cannot be earlier than start time.")
  })

  it("accepts empty optional fields and rejects unknown input", () => {
    expect(
      createQuestSchema.parse({
        description: null,
        dueAt: "",
        priority: "medium",
        startAt: "",
        title: "Unscheduled Quest",
      }),
    ).toMatchObject({ description: "", dueAt: null, startAt: null })

    expect(
      createQuestSchema.safeParse({ ...validQuest, workspaceId: randomUUID() })
        .success,
    ).toBe(false)
  })

  it("requires a name when custom task type is selected", () => {
    const unnamed = createQuestSchema.safeParse({
      ...validQuest,
      customType: "",
      taskType: "custom",
    })
    expect(unnamed.success).toBe(false)
    expect(
      unnamed.success ? [] : unnamed.error.flatten().fieldErrors.customType,
    ).toContain("Name your custom task type.")

    expect(
      createQuestSchema.safeParse({
        ...validQuest,
        customType: "Fitness",
        taskType: "custom",
      }).success,
    ).toBe(true)
  })

  it("requires valid identifiers and positive optimistic versions", () => {
    const questId = randomUUID()
    expect(
      questTransitionSchema.safeParse({ expectedVersion: 1, questId }).success,
    ).toBe(true)
    expect(
      questTransitionSchema.safeParse({ expectedVersion: 0, questId }).success,
    ).toBe(false)
    expect(
      editQuestSchema.safeParse({
        ...validQuest,
        expectedVersion: 1,
        questId: "not-a-uuid",
      }).success,
    ).toBe(false)
  })

  it("bounds Quest ordering and rejects duplicate identifiers", () => {
    const questId = randomUUID()
    expect(
      questReorderSchema.safeParse({
        quests: [
          { expectedVersion: 1, questId },
          { expectedVersion: 1, questId },
        ],
      }).success,
    ).toBe(false)
    expect(
      questReorderSchema.safeParse({
        quests: [
          { expectedVersion: 1, questId },
          { expectedVersion: 1, questId: randomUUID() },
        ],
      }).success,
    ).toBe(true)
  })
})

describe("schedule-only edits", () => {
  const base = { expectedVersion: 2, questId: randomUUID() }

  it("parses only supplied local minutes in the saved timezone", () => {
    const result = parseEditQuestSchedule(
      { ...base, dueAt: "2026-11-01T09:30" },
      "Asia/Kolkata",
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual({
      ...base,
      dueAt: new Date("2026-11-01T04:00:00.000Z"),
    })
    expect(result.data).not.toHaveProperty("startAt")
  })

  it("preserves null clears and requires at least one supplied schedule value", () => {
    expect(parseEditQuestSchedule({ ...base, startAt: null }, "UTC")).toEqual({
      success: true,
      data: { ...base, startAt: null },
    })
    for (const input of [base, { ...base, startAt: undefined }]) {
      expect(parseEditQuestSchedule(input, "UTC").success).toBe(false)
      expect(editQuestScheduleSchema.safeParse(input).success).toBe(false)
    }
  })

  it.each([
    ["2026-02-30T09:00", "UTC"],
    ["2026-08-08T24:00", "UTC"],
    ["2026-08-08T09:00", "Invalid/Timezone"],
    ["2026-03-08T02:30", "America/New_York"],
    ["2026-08-08T09:00:12Z", "UTC"],
    ["", "UTC"],
    [new Date("2026-08-08T09:00Z"), "UTC"],
  ])("rejects invalid local input %s in %s", (startAt, timezone) => {
    expect(parseEditQuestSchedule({ ...base, startAt }, timezone).success).toBe(
      false,
    )
  })

  it("uses the existing deterministic offset for a changed fall-back minute", () => {
    const result = parseEditQuestSchedule(
      { ...base, startAt: "2026-11-01T01:30" },
      "America/New_York",
    )
    expect(result).toEqual({
      success: true,
      data: { ...base, startAt: new Date("2026-11-01T05:30:00.000Z") },
    })
  })

  it("rejects reversed schedules but accepts equal start and due instants", () => {
    const input = { ...base, startAt: "2026-11-01T09:30" }
    const reversed = parseEditQuestSchedule(
      { ...input, dueAt: "2026-11-01T09:29" },
      "Asia/Kolkata",
    )
    expect(reversed.success).toBe(false)
    if (!reversed.success) {
      expect(reversed.error.flatten().fieldErrors.dueAt).toContain(
        "Due time cannot be earlier than start time.",
      )
    }
    expect(
      parseEditQuestSchedule({ ...input, dueAt: input.startAt }, "Asia/Kolkata")
        .success,
    ).toBe(true)
  })

  it.each([
    { title: "Unrelated edit" },
    { recurrenceRule: "FREQ=DAILY" },
    { expectedVersion: 0 },
    { questId: "invalid" },
  ])("rejects unrelated fields or invalid identity: %o", (extra) => {
    expect(
      parseEditQuestSchedule({ ...base, dueAt: null, ...extra }, "UTC").success,
    ).toBe(false)
  })
})

describe("new task schedules must stay in the future", () => {
  const timezone = "Asia/Kolkata"
  const now = new Date("2026-08-11T12:00:00.000Z")
  const base = {
    description: "",
    priority: "medium",
    title: "Push ups",
  }

  it("rejects a due time that has already passed", () => {
    const result = parseCreateQuestForm(
      { ...base, dueAt: "2026-08-11T16:00", startAt: "" },
      timezone,
      { now },
    )

    expect(result.success).toBe(false)
    expect(
      result.success ? null : result.error.flatten().fieldErrors.dueAt?.[0],
    ).toMatch(/already passed/u)
  })

  it("rejects a start time that has already passed", () => {
    const result = parseCreateQuestForm(
      { ...base, dueAt: "", startAt: "2026-08-11T09:00" },
      timezone,
      { now },
    )

    expect(result.success).toBe(false)
    expect(
      result.success ? null : result.error.flatten().fieldErrors.startAt?.[0],
    ).toMatch(/already passed/u)
  })

  it("accepts a window still ahead in the workspace zone", () => {
    // 18:30 IST is 13:00Z, one hour after the injected present.
    const result = parseCreateQuestForm(
      { ...base, dueAt: "2026-08-11T19:00", startAt: "2026-08-11T18:30" },
      timezone,
      { now },
    )

    expect(result.success).toBe(true)
  })

  it("keeps tasks without a schedule valid", () => {
    expect(
      parseCreateQuestForm({ ...base, dueAt: "", startAt: "" }, timezone, {
        now,
      }).success,
    ).toBe(true)
  })

  it("lets queued offline work sync after its window closed", () => {
    const result = parseCreateQuestForm(
      { ...base, dueAt: "2026-08-11T16:00", startAt: "" },
      timezone,
      { allowElapsedSchedule: true, now },
    )

    expect(result.success).toBe(true)
  })

  it("leaves edits of an already overdue task alone", () => {
    const result = parseEditQuestForm(
      {
        ...base,
        dueAt: "2026-08-11T16:00",
        expectedVersion: 2,
        questId: "00000000-0000-4000-8000-000000000001",
        startAt: "",
      },
      timezone,
    )

    expect(result.success).toBe(true)
  })

  it("requires a fresh future timeline before restoring", () => {
    const questId = "00000000-0000-4000-8000-000000000001"
    const valid = parseRestoreQuestSchedule(
      {
        dueAt: "2026-08-11T19:30",
        expectedVersion: 3,
        questId,
        startAt: "2026-08-11T18:30",
      },
      timezone,
      now,
    )
    const elapsed = parseRestoreQuestSchedule(
      {
        dueAt: "2026-08-11T17:15",
        expectedVersion: 3,
        questId,
        startAt: "2026-08-11T17:00",
      },
      timezone,
      now,
    )
    const reversed = parseRestoreQuestSchedule(
      {
        dueAt: "2026-08-11T18:30",
        expectedVersion: 3,
        questId,
        startAt: "2026-08-11T19:30",
      },
      timezone,
      now,
    )
    const nextDay = parseRestoreQuestSchedule(
      {
        dueAt: "2026-08-12T10:00",
        expectedVersion: 3,
        questId,
        startAt: "2026-08-12T09:00",
      },
      timezone,
      now,
      { sameDayOnly: true },
    )
    const nextDayForOrdinaryReschedule = parseRestoreQuestSchedule(
      {
        dueAt: "2026-08-12T10:00",
        expectedVersion: 3,
        questId,
        startAt: "2026-08-12T09:00",
      },
      timezone,
      now,
    )

    expect(valid.success).toBe(true)
    expect(elapsed.success).toBe(false)
    expect(reversed.success).toBe(false)
    expect(nextDay.success).toBe(false)
    expect(nextDayForOrdinaryReschedule.success).toBe(true)
  })
})
