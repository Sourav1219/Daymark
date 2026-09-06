import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TodayTasks } from "@/features/today/components/today-tasks"
import { taskCompletionUndoEvent } from "@/features/quests/domain/quest-links"

const navigation = vi.hoisted(() => ({
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/today",
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/features/quests/application/actions", () => ({
  classifyQuestAction: vi.fn(),
  completeQuestAction: vi.fn(),
  editQuestScheduleAction: vi.fn(),
  softDeleteQuestAction: vi.fn(),
}))

vi.mock(
  "@/features/quests/components/task-completion-celebration-provider",
  () => ({
    useTaskCompletionCelebration: () => vi.fn(),
  }),
)

describe("TodayTasks completed section", () => {
  it("renders a collapsible 'Completed today' section that can be toggled", () => {
    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                id: "open-1",
                priority: "high",
                status: "open",
                steps: 0,
                timeLabel: "10:00",
                title: "Active task",
                version: 1,
              },
            ],
            title: "My tasks",
          },
          {
            cards: [
              {
                id: "completed-1",
                priority: "medium",
                status: "completed",
                steps: 0,
                timeLabel: "Any time",
                title: "Finished morning report",
                version: 2,
              },
            ],
            title: "Completed today",
          },
        ]}
      />,
    )

    // Active task and completed task are visible initially
    expect(screen.getByText("Active task")).toBeVisible()
    expect(screen.getByText("Finished morning report")).toBeVisible()

    // The collapse button exists and is expanded
    const collapseToggle = screen.getByRole("button", {
      name: /Completed today, 1 task/i,
    })
    expect(collapseToggle).toHaveAttribute("aria-expanded", "true")

    // Clicking toggles collapse
    fireEvent.click(collapseToggle)
    expect(collapseToggle).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByText("Finished morning report"),
    ).not.toBeInTheDocument()

    // Clicking again expands it back
    fireEvent.click(collapseToggle)
    expect(collapseToggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Finished morning report")).toBeVisible()
  })

  it("renders completed task card with completed status indicator", () => {
    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                id: "completed-2",
                priority: "low",
                status: "completed",
                steps: 0,
                timeLabel: "Any time",
                title: "Clean desk",
                version: 1,
              },
            ],
            title: "Completed today",
          },
        ]}
      />,
    )

    expect(screen.getByLabelText("Clean desk completed")).toBeVisible()
    const card = screen.getByLabelText("Clean desk").closest("article")
    expect(card).toHaveAttribute("data-status", "completed")
  })

  it("moves an undone completion back to active tasks immediately", () => {
    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                id: "completed-undo",
                priority: "medium",
                status: "completed",
                steps: 0,
                timeLabel: "Any time",
                title: "Return immediately",
                version: 2,
              },
            ],
            title: "Completed today",
          },
        ]}
      />,
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent(taskCompletionUndoEvent, {
          detail: {
            phase: "started",
            questId: "completed-undo",
          },
        }),
      )
    })

    expect(screen.getByRole("heading", { name: "My tasks" })).toBeVisible()
    expect(
      screen.queryByLabelText("Return immediately completed"),
    ).not.toBeInTheDocument()
    const reopenedCard = screen.getByRole("article", {
      name: "Return immediately",
    })
    expect(reopenedCard).toHaveAttribute("data-status", "open")
    expect(reopenedCard).toHaveAttribute("data-reopening", "true")
    expect(
      screen.getByRole("button", { name: "Clear Return immediately" }),
    ).toBeDisabled()

    act(() => {
      window.dispatchEvent(
        new CustomEvent(taskCompletionUndoEvent, {
          detail: {
            phase: "confirmed",
            questId: "completed-undo",
            version: 3,
          },
        }),
      )
    })

    expect(
      screen.getByRole("article", { name: "Return immediately" }),
    ).toHaveAttribute("data-reopening", "false")
    expect(
      screen.getByRole("button", { name: "Clear Return immediately" }),
    ).toBeEnabled()
  })

  it("remounts an active card when undo wins the completion refresh race", () => {
    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                id: "active-undo-race",
                priority: "high",
                status: "open",
                steps: 0,
                timeLabel: "11:00",
                title: "Fast undo",
                version: 4,
              },
            ],
            title: "My tasks",
          },
        ]}
      />,
    )

    const originalCard = screen.getByRole("article", { name: "Fast undo" })

    act(() => {
      window.dispatchEvent(
        new CustomEvent(taskCompletionUndoEvent, {
          detail: {
            phase: "started",
            questId: "active-undo-race",
          },
        }),
      )
    })

    const reopenedCard = screen.getByRole("article", { name: "Fast undo" })
    expect(reopenedCard).not.toBe(originalCard)
    expect(reopenedCard).toHaveAttribute("data-reopening", "true")
    expect(reopenedCard).toHaveAttribute("data-status", "open")
  })

  it("keeps classification open after changing task type", async () => {
    const { classifyQuestAction } =
      await import("@/features/quests/application/actions")
    vi.mocked(classifyQuestAction).mockResolvedValueOnce({
      data: { id: "open-1", version: 2 },
      ok: true,
    })

    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                id: "open-1",
                priority: "high",
                status: "open",
                steps: 0,
                timeLabel: "10:00",
                title: "Active task",
                version: 1,
              },
            ],
            title: "My tasks",
          },
        ]}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: /Edit Active task:/i,
    })
    expect(trigger).toBeVisible()

    // Open classification panel
    fireEvent.click(trigger)
    expect(
      screen.getByLabelText("Edit Active task"),
    ).toBeVisible()

    // Select Work type - save without closing the panel
    const workBtn = screen.getByRole("button", { name: /Work/i })
    fireEvent.click(workBtn)

    expect(classifyQuestAction).toHaveBeenCalledWith({
      customType: null,
      expectedVersion: 1,
      questId: "open-1",
      taskType: "work",
    })

    expect(
      screen.getByLabelText("Edit Active task"),
    ).toBeVisible()

    await screen.findByText("Your choice is saved.")
    fireEvent.click(
      screen.getByRole("button", { name: "Done editing" }),
    )
    expect(
      screen.queryByLabelText("Edit Active task"),
    ).not.toBeInTheDocument()
  })

  it("keeps classification open after changing priority", async () => {
    const { classifyQuestAction } =
      await import("@/features/quests/application/actions")
    vi.mocked(classifyQuestAction).mockResolvedValueOnce({
      data: { id: "open-1", version: 2 },
      ok: true,
    })

    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                id: "open-1",
                priority: "low",
                status: "open",
                steps: 0,
                timeLabel: "10:00",
                title: "Active task",
                version: 1,
              },
            ],
            title: "My tasks",
          },
        ]}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: /Edit Active task:/i,
    })
    fireEvent.click(trigger)
    expect(
      screen.getByLabelText("Edit Active task"),
    ).toBeVisible()

    // Priority buttons should be present
    const criticalBtn = screen.getByRole("button", { name: /^Critical$/i })
    expect(criticalBtn).toBeVisible()

    // Click Critical priority
    fireEvent.click(criticalBtn)

    expect(classifyQuestAction).toHaveBeenCalledWith({
      expectedVersion: 1,
      priority: "critical",
      questId: "open-1",
    })

    expect(
      screen.getByLabelText("Edit Active task"),
    ).toBeVisible()
  })

  it("renders a single edit trigger that opens the unified panel with Task type, Priority, and Schedule sections", () => {
    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                dateLabel: "Tomorrow",
                id: "open-1",
                priority: "medium",
                startAt: "2026-11-01T09:00:00.000Z",
                dueAt: "2026-11-01T17:00:00.000Z",
                status: "open",
                steps: 2,
                timeLabel: "09:00 – 17:00",
                title: "Unified edit test task",
                version: 1,
              },
            ],
            title: "Today",
          },
        ]}
        timezone="UTC"
      />,
    )

    // Verify there is only one edit button for this task, not two
    const editButtons = screen.getAllByRole("button", {
      name: /Edit Unified edit test task/i,
    })
    expect(editButtons).toHaveLength(1)

    // Schedule meta is displayed statically with icons
    expect(screen.getByText("Tomorrow")).toBeVisible()
    expect(screen.getByText("09:00 – 17:00")).toBeVisible()

    // Open the unified panel
    fireEvent.click(editButtons[0]!)
    const panel = screen.getByLabelText("Edit Unified edit test task")
    expect(panel).toBeVisible()

    // All three sections are present in one unified panel
    expect(screen.getByText("Task type")).toBeVisible()
    expect(screen.getByText("Priority")).toBeVisible()
    expect(screen.getByText("Schedule")).toBeVisible()

    // Schedule inputs are present
    expect(screen.getByLabelText("Start date")).toBeVisible()
    expect(screen.getByLabelText("Due date")).toBeVisible()
    expect(screen.getByText("Times shown in UTC")).toBeVisible()
  })

  it("does not render classification trigger on completed tasks", () => {
    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                id: "completed-1",
                priority: "medium",
                status: "completed",
                steps: 0,
                timeLabel: "Any time",
                title: "Finished morning report",
                version: 2,
              },
            ],
            title: "Completed today",
          },
        ]}
      />,
    )

    expect(
      screen.queryByRole("button", {
        name: /Edit Finished morning report:/i,
      }),
    ).not.toBeInTheDocument()
  })

  it("does not steal focus from an active input when sections re-render with focusedQuestId", () => {
    // Create an input in the document and focus it
    const searchInput = document.createElement("input")
    searchInput.type = "search"
    document.body.appendChild(searchInput)
    searchInput.focus()
    expect(document.activeElement).toBe(searchInput)

    const { rerender } = render(
      <TodayTasks
        empty={false}
        focusedQuestId="open-1"
        sections={[
          {
            cards: [
              {
                id: "open-1",
                priority: "high",
                status: "open",
                steps: 0,
                timeLabel: "10:00",
                title: "Active task",
                version: 1,
              },
            ],
            title: "My tasks",
          },
        ]}
      />,
    )

    // Active element must still be searchInput, NOT the task card!
    expect(document.activeElement).toBe(searchInput)

    // Re-render with new sections (like when user types a letter and list is filtered)
    rerender(
      <TodayTasks
        empty={false}
        focusedQuestId="open-1"
        sections={[
          {
            cards: [
              {
                id: "open-1",
                priority: "high",
                status: "open",
                steps: 0,
                timeLabel: "10:00",
                title: "Active task",
                version: 1,
              },
            ],
            title: "My tasks",
          },
        ]}
      />,
    )

    expect(document.activeElement).toBe(searchInput)
    document.body.removeChild(searchInput)
  })

  it("immediately removes the missed section and opens the trash popup before deletion resolves", async () => {
    const { softDeleteQuestAction } =
      await import("@/features/quests/application/actions")
    let finishDelete:
      | ((value: { data: { id: string; version: number }; ok: true }) => void)
      | undefined
    vi.mocked(softDeleteQuestAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDelete = resolve
        }),
    )

    render(
      <TodayTasks
        empty={false}
        referenceNow="2026-09-06T12:00:00Z"
        sections={[
          {
            cards: [
              {
                dueAt: "2026-09-06T08:00:00Z",
                id: "missed-1",
                priority: "medium",
                status: "failed",
                steps: 0,
                timeLabel: "08:00",
                title: "Bathing",
                version: 1,
              },
            ],
            title: "Missed",
          },
        ]}
      />,
    )

    const trashBtn = screen.getByRole("button", {
      name: "Move missed task Bathing to Trash",
    })
    expect(trashBtn).toBeVisible()

    fireEvent.click(trashBtn)

    // The optimistic UI must not wait for the deliberately unresolved request.
    expect(screen.queryByLabelText("Bathing")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Missed" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Moved to Trash" })).toBeVisible()
    expect(softDeleteQuestAction).toHaveBeenCalledWith({
      expectedVersion: 1,
      questId: "missed-1",
    })

    await act(async () => {
      finishDelete?.({
        data: { id: "missed-1", version: 2 },
        ok: true,
      })
    })

    expect(screen.getByRole("dialog", { name: "Moved to Trash" })).toBeVisible()
    expect(screen.queryByLabelText("Bathing")).not.toBeInTheDocument()
  })

  it("restores an optimistically removed missed task when deletion fails", async () => {
    const { softDeleteQuestAction } =
      await import("@/features/quests/application/actions")
    let failDelete:
      | ((value: {
          error: { code: "INTERNAL_ERROR"; message: string }
          ok: false
        }) => void)
      | undefined
    vi.mocked(softDeleteQuestAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          failDelete = resolve
        }),
    )

    render(
      <TodayTasks
        empty={false}
        referenceNow="2026-09-06T12:00:00Z"
        sections={[
          {
            cards: [
              {
                dueAt: "2026-09-06T08:00:00Z",
                id: "missed-rollback",
                priority: "medium",
                status: "failed",
                steps: 0,
                timeLabel: "08:00",
                title: "Retry me",
                version: 1,
              },
            ],
            title: "Missed",
          },
        ]}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: "Move missed task Retry me to Trash",
      }),
    )

    expect(screen.queryByLabelText("Retry me")).not.toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Moved to Trash" })).toBeVisible()

    await act(async () => {
      failDelete?.({
        error: { code: "INTERNAL_ERROR", message: "Delete failed" },
        ok: false,
      })
    })

    expect(screen.getByLabelText("Retry me")).toBeVisible()
    expect(screen.getByRole("heading", { name: "Missed" })).toBeVisible()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
