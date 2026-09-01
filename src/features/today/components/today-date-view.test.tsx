import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TodayDateView } from "./today-date-view"

vi.mock("@/features/today/components/today-header", () => ({
  TodayHeader: ({
    onDateNavigate,
    selectedDate,
  }: {
    onDateNavigate: (date: string) => void
    selectedDate: string
  }) => (
    <div>
      <span>Calendar {selectedDate}</span>
      <button onClick={() => onDateNavigate("2026-08-31")} type="button">
        Show August 31
      </button>
      <button onClick={() => onDateNavigate("2026-08-01")} type="button">
        Show uncached date
      </button>
    </div>
  ),
}))

vi.mock("@/features/today/components/today-tasks", () => ({
  TodayTasks: ({
    sections,
    selectedDate,
  }: {
    sections: readonly {
      cards: readonly { title: string }[]
      title: string
    }[]
    selectedDate: string
  }) => (
    <div>
      Tasks {selectedDate}:{" "}
      {sections
        .flatMap(({ cards }) => cards.map(({ title }) => title))
        .join(",")}
    </div>
  ),
}))

vi.mock("@/features/timer/components/daily-study-history", () => ({
  DailyStudyHistory: ({ selectedDate }: { selectedDate: string }) => (
    <div>Study {selectedDate}</div>
  ),
}))

vi.mock("@/features/today/components/today-filters", () => ({
  TodayFilters: () => null,
}))

vi.mock("@/features/today/components/today-promo", () => ({
  TodayPromo: () => null,
}))

vi.mock("@/features/quests/components/quest-pagination", () => ({
  QuestPagination: () => null,
}))

const commonDay = {
  hasNextPage: false,
  page: 1,
} as const

describe("TodayDateView", () => {
  it("swaps the preloaded task and study content on the same click", async () => {
    const user = userEvent.setup()
    render(
      <TodayDateView
        activeLabelId="any"
        days={[
          {
            ...commonDay,
            date: "2026-09-01",
            historical: false,
            sections: [
              {
                cards: [
                  {
                    id: "today",
                    priority: "medium",
                    status: "open",
                    steps: 0,
                    timeLabel: "Any time",
                    title: "Today quest",
                    version: 1,
                  },
                ],
                title: "My tasks",
              },
            ],
          },
          {
            ...commonDay,
            date: "2026-08-31",
            historical: true,
            sections: [
              {
                cards: [
                  {
                    id: "earlier",
                    priority: "low",
                    status: "completed",
                    steps: 0,
                    timeLabel: "Any time",
                    title: "Earlier quest",
                    version: 1,
                  },
                ],
                title: "Completed",
              },
            ],
          },
        ]}
        history={[]}
        inbox={{ dueSoonQuests: [] }}
        labels={[]}
        referenceNow="2026-09-01T12:00:00.000Z"
        selectedDate="2026-09-01"
        streak={0}
        timezone="UTC"
        todayDate="2026-09-01"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Show August 31" }))

    expect(screen.getByText("Calendar 2026-08-31")).toBeVisible()
    expect(screen.getByText(/Tasks 2026-08-31: Earlier quest/u)).toBeVisible()
    expect(screen.getByText("Study 2026-08-31")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Show uncached date" }))
    expect(screen.getByText("Calendar 2026-08-31")).toBeVisible()
  })
})
