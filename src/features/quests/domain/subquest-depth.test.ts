import { describe, expect, it } from "vitest"

import {
  canNestUnder,
  maxSubquestDepth,
} from "@/features/quests/domain/subquest-depth"
import {
  defaultQuestFilters,
  isQuestFiltered,
  questMutationBatchLimit,
  questPageSize,
} from "@/features/quests/domain/types"

describe("Subquest depth policy", () => {
  it("exposes a deliberately limited nesting depth", () => {
    expect(maxSubquestDepth).toBe(2)
  })

  it("allows nesting up to the limit and refuses anything deeper", () => {
    // A Quest with no ancestors becomes depth 1; depth 2 is the ceiling.
    expect(canNestUnder(0)).toBe(true)
    expect(canNestUnder(1)).toBe(true)
    expect(canNestUnder(2)).toBe(false)
    expect(canNestUnder(3)).toBe(false)
  })
})

describe("isQuestFiltered", () => {
  it("reports the default filter set as unfiltered", () => {
    expect(isQuestFiltered(defaultQuestFilters)).toBe(false)
    expect(isQuestFiltered({ ...defaultQuestFilters })).toBe(false)
  })

  it("flags any single deviation from the defaults", () => {
    expect(isQuestFiltered({ ...defaultQuestFilters, search: "blade" })).toBe(
      true,
    )
    expect(isQuestFiltered({ ...defaultQuestFilters, status: "all" })).toBe(
      true,
    )
    expect(isQuestFiltered({ ...defaultQuestFilters, priority: "high" })).toBe(
      true,
    )
    expect(isQuestFiltered({ ...defaultQuestFilters, gateId: "none" })).toBe(
      true,
    )
    expect(isQuestFiltered({ ...defaultQuestFilters, due: "overdue" })).toBe(
      true,
    )
    expect(
      isQuestFiltered({ ...defaultQuestFilters, sort: "due-soonest" }),
    ).toBe(true)
  })

  it("keeps list queries bounded by a hard cap", () => {
    expect(questPageSize).toBe(50)
    expect(questMutationBatchLimit).toBe(1_000)
  })
})
