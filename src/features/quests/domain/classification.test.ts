import { describe, expect, it } from "vitest"
import {
  classificationAfterEdit,
  formatTaskTypeLabel,
  suggestClassification,
} from "./classification"

describe("task classification", () => {
  it.each([
    ["Reply to client email", "work"],
    ["Revise calculus chapter", "study"],
    ["Buy detergent", "personal"],
    ["Gym workout", "personal"],
    ["Something to do", "personal"],
  ])("suggests %s without using priority", (title, taskType) => {
    expect(suggestClassification(title)).toEqual({
      taskType,
      customType: null,
      typeManual: false,
    })
  })

  it("formats task type label correctly for standard and custom types", () => {
    expect(formatTaskTypeLabel({ taskType: "work" })).toBe("Work")
    expect(formatTaskTypeLabel({ taskType: "personal" })).toBe("Personal")
    expect(formatTaskTypeLabel({ taskType: "study" })).toBe("Study")
    expect(formatTaskTypeLabel({ taskType: "custom", customType: "Gym" })).toBe(
      "Gym",
    )
    expect(formatTaskTypeLabel({ taskType: "custom", customType: "" })).toBe(
      "Custom",
    )
    expect(formatTaskTypeLabel({ taskType: "custom", customType: null })).toBe(
      "Custom",
    )
  })

  it("uses descriptions to find matching task type", () => {
    expect(
      suggestClassification("Prepare", "Revise the calculus chapter").taskType,
    ).toBe("study")
    expect(
      suggestClassification("Important task", "Send invoice to client")
        .taskType,
    ).toBe("work")
  })

  it("preserves manually corrected taskType and customType", () => {
    expect(
      classificationAfterEdit(
        { taskType: "custom", customType: "Freelance", typeManual: true },
        "Revise calculus",
        "",
      ),
    ).toEqual({
      taskType: "custom",
      customType: "Freelance",
      typeManual: true,
    })
  })
})
