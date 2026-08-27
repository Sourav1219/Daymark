import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  DailyStudyHistoryLoading,
  TodayLoadingState,
} from "./today-loading-state"

describe("TodayLoadingState", () => {
  it("uses a single accessible status shaped like the Today page", () => {
    const { container } = render(<TodayLoadingState />)

    expect(
      screen.getByRole("status", { name: "Loading your day" }),
    ).toBeInTheDocument()
    expect(container.querySelectorAll(".today-day")).toHaveLength(7)
    expect(container.querySelectorAll(".today-loading__card")).toHaveLength(3)
  })

  it("provides an independent fallback for streamed study history", () => {
    render(<DailyStudyHistoryLoading />)

    expect(
      screen.getByRole("status", { name: "Loading study history" }),
    ).toBeInTheDocument()
  })
})
