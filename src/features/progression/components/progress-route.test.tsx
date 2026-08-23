import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getProgressionDashboard } = vi.hoisted(() => ({
  getProgressionDashboard: vi.fn(),
}))

vi.mock("@/features/progression/queries/progression-query-service", () => ({
  getProgressionDashboard,
}))

import { ProgressRoute } from "./progress-route"

const access = {
  role: "owner" as const,
  userId: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
}

describe("ProgressRoute", () => {
  beforeEach(() => {
    getProgressionDashboard.mockResolvedValue({
      bestStreak: 4,
      currentStreak: 3,
      daily: { goal: 50, percent: 70, xp: 35 },
      history: [
        {
          earnedForLocalDate: "2026-08-08",
          eventType: "quest_completion",
          occurredAt: "2026-08-08T12:00:00.000Z",
          questId: "33333333-3333-4333-8333-333333333333",
          questTitle: "Accessible task",
          reason: "quest_completion",
          xpDelta: 35,
        },
        {
          earnedForLocalDate: "2026-08-08",
          eventType: "quest_reopened",
          occurredAt: "2026-08-08T13:00:00.000Z",
          questId: "44444444-4444-4444-8444-444444444444",
          questTitle: "Corrected task",
          reason: "quest_reopen_reversal",
          xpDelta: -20,
        },
      ],
      level: {
        currentThreshold: 250,
        level: 3,
        nextThreshold: 450,
        percent: 67,
        pointsForLevel: 200,
        pointsInLevel: 135,
        pointsToNextLevel: 65,
      },
      timezone: "UTC",
      totalXp: 385,
      weekly: { goal: 250, percent: 36, xp: 90 },
    })
  })

  it("renders points, streak, bounded progress semantics, and correction history", async () => {
    render(await ProgressRoute({ access }))

    expect(
      screen.getByRole("heading", { level: 1, name: "Your progress" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/rank|hunter/iu)).not.toBeInTheDocument()
    expect(screen.getByText("Current level")).toBeInTheDocument()
    expect(screen.getByText("Level 4")).toBeInTheDocument()
    expect(screen.getByText("65 points away")).toBeInTheDocument()
    expect(screen.getAllByText("3")).toHaveLength(2)
    expect(screen.getByText("4")).toBeInTheDocument()

    const progressbars = screen.getAllByRole("progressbar")
    expect(progressbars).toHaveLength(3)
    expect(progressbars[0]).toHaveAccessibleName(
      "Level 3 progress: 135 of 200 points",
    )
    expect(progressbars[1]).toHaveAccessibleName("Today: 35 of 50 points")
    expect(progressbars[2]).toHaveAccessibleName("This week: 90 of 250 points")

    const history = screen.getByRole("region", { name: "Progress history" })
    expect(within(history).getByText("Accessible task")).toBeInTheDocument()
    expect(
      within(history).getByRole("link", { name: "Accessible task" }),
    ).toHaveAttribute(
      "href",
      "/today?date=2026-08-08&task=33333333-3333-4333-8333-333333333333",
    )
    expect(within(history).getByText("+35 points")).toBeInTheDocument()
    expect(within(history).getByText("-20 points")).toBeInTheDocument()
    expect(
      within(history).getByText("Reopened task correction"),
    ).toBeInTheDocument()
  })
})
