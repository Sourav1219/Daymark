import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { defaultQuestFilters } from "@/features/quests/domain/types"
import { parseQuestFilters } from "@/features/quests/validation/quest-validation"

describe("parseQuestFilters", () => {
  it("returns the defaults when no parameters are present", () => {
    expect(parseQuestFilters({})).toEqual(defaultQuestFilters)
  })

  it("keeps valid shareable filter values", () => {
    const gateId = randomUUID()
    const labelId = randomUUID()

    expect(
      parseQuestFilters({
        due: "overdue",
        gateId,
        labelId,
        priority: "critical",
        search: "  blade  ",
        sort: "due-soonest",
        status: "all",
      }),
    ).toEqual({
      due: "overdue",
      gateId,
      labelId,
      priority: "critical",
      search: "blade",
      sort: "due-soonest",
      status: "all",
    })
  })

  it("supports the 'none' Gate filter but not it for Labels", () => {
    const parsed = parseQuestFilters({ gateId: "none", labelId: "none" })

    expect(parsed.gateId).toBe("none")
    expect(parsed.labelId).toBe("any")
  })

  it("falls back to defaults for malformed values instead of failing", () => {
    expect(
      parseQuestFilters({
        due: "someday",
        gateId: "not-a-uuid",
        labelId: "not-a-uuid",
        priority: "legendary",
        sort: "alphabetical",
        status: "archived",
      }),
    ).toEqual(defaultQuestFilters)
  })

  it("truncates oversized search terms to the safe default", () => {
    expect(parseQuestFilters({ search: "x".repeat(161) }).search).toBe("")
  })

  it("uses only the first value for repeated parameters", () => {
    expect(parseQuestFilters({ status: ["all", "open"] }).status).toBe("all")
    expect(parseQuestFilters({ search: ["first", "second"] }).search).toBe(
      "first",
    )
  })
})
