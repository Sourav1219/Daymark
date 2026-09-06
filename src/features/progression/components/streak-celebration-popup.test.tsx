import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  StreakCelebrationPopup,
  streakCelebrationDurationMs,
} from "./streak-celebration-popup"
import * as questActions from "@/features/quests/application/actions"

const navigation = vi.hoisted(() => ({
  prefetch: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}))

vi.mock("@/features/quests/application/actions", () => ({
  reopenQuestAction: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe("StreakCelebrationPopup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses 8000ms duration matching regular completion popups", () => {
    expect(streakCelebrationDurationMs).toBe(8_000)
  })

  it("reopens task, shows Streak updated with 8s timer, and has working continue button", async () => {
    let confirmUndo: (() => void) | undefined
    const undoPromise = new Promise<{
      data: {
        id: string
        version: number
      }
      ok: true
    }>((resolve) => {
      confirmUndo = () =>
        resolve({
          data: {
            id: "streak-task-1",
            version: 2,
          },
          ok: true,
        })
    })

    vi.mocked(questActions.reopenQuestAction).mockReturnValue(
      undoPromise as unknown as ReturnType<
        typeof questActions.reopenQuestAction
      >,
    )
    const onDismiss = vi.fn()
    const user = userEvent.setup()

    render(
      <StreakCelebrationPopup
        notice={{
          count: 5,
          task: {
            currentStreak: 5,
            id: "streak-task-1",
            streakIncreased: true,
            title: "Morning Routine",
            version: 1,
            xpEarned: 35,
          },
        }}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByText("5 days strong")).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Undo completion" }),
    ).toBeVisible()

    // Click Undo
    await user.click(screen.getByRole("button", { name: "Undo completion" }))

    // Optimistically transitions to Streak updated
    expect(
      screen.getByRole("heading", { name: "Streak updated" }),
    ).toBeVisible()
    expect(
      screen.getByText(
        "The completion was undone and your streak has been recalculated.",
      ),
    ).toBeVisible()

    // Continue button is rendered, enabled, and clickable
    const continueButton = screen.getByRole("button", { name: "Continue" })
    expect(continueButton).toBeVisible()
    expect(continueButton).toBeEnabled()

    // Clicking continue button dismisses the popup and navigates to /today
    await user.click(continueButton)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(navigation.replace).toHaveBeenCalledWith("/today")

    // Confirm background undo finishes cleanly
    confirmUndo?.()
    expect(questActions.reopenQuestAction).toHaveBeenCalledWith({
      expectedVersion: 1,
      questId: "streak-task-1",
    })
  })
})
