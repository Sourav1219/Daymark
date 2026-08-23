import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DailyStudyHistory } from "./daily-study-history"

describe("DailyStudyHistory", () => {
  it("renders only the history for the selected local date", () => {
    render(
      <DailyStudyHistory
        history={[
          { localDate: "2026-08-20", sessionCount: 2, totalMs: 3_600_000 },
          { localDate: "2026-08-21", sessionCount: 1, totalMs: 1_800_000 },
        ]}
        selectedDate="2026-08-21"
      />,
    )

    expect(screen.getByText("1 day")).toBeInTheDocument()
    expect(screen.getByText("August 21, 2026")).toBeInTheDocument()
    expect(screen.queryByText("August 20, 2026")).not.toBeInTheDocument()
  })

  it("shows a selected-day empty state", () => {
    render(
      <DailyStudyHistory
        history={[
          { localDate: "2026-08-20", sessionCount: 2, totalMs: 3_600_000 },
        ]}
        selectedDate="2026-08-21"
      />,
    )

    expect(screen.getByText("0 days")).toBeInTheDocument()
    expect(
      screen.getByText("No study time recorded for this day"),
    ).toBeInTheDocument()
  })
})
