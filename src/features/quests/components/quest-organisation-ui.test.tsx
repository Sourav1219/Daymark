import { useState } from "react"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { QuestFormFields } from "@/features/quests/components/quest-form-fields"
import { QuestTimePicker } from "@/features/quests/components/quest-time-picker"
import { QuestFilterBar } from "@/features/quests/components/quest-filter-bar"
import { QuestActiveBoard } from "@/features/quests/components/quest-active-board"
import { QuestList } from "@/features/quests/components/quest-list"
import { TaskCreatedPopup } from "@/features/quests/components/task-created-popup"
import { TaskCompletedPopup } from "@/features/quests/components/task-completed-popup"
import { StreakButton } from "@/features/progression/components/streak-button"
import {
  TaskCompletionCelebrationProvider,
  useTaskCompletionCelebration,
} from "@/features/quests/components/task-completion-celebration-provider"
import { TodayTasks } from "@/features/today/components/today-tasks"
import {
  defaultQuestFilters,
  type QuestView,
} from "@/features/quests/domain/types"

const questActions = vi.hoisted(() => ({
  completeQuestAction: vi.fn(),
  createQuestAction: vi.fn(),
  editQuestAction: vi.fn(),
  permanentlyDeleteQuestAction: vi.fn(),
  reopenQuestAction: vi.fn(),
  reorderQuestsAction: vi.fn(),
  restoreQuestAction: vi.fn(),
  restoreQuestWithScheduleAction: vi.fn(),
  softDeleteQuestAction: vi.fn(),
}))
const navigation = vi.hoisted(() => ({
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}))
vi.mock("@/features/quests/application/actions", () => questActions)

vi.mock("@/features/offline/components/offline-provider", () => ({
  useOffline: () => ({
    queueCompletion: vi.fn(),
    snapshotQuests: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/quests",
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(),
}))

function quest(id: string, parentTaskId: string | null = null): QuestView {
  return {
    completedAt: null,
    deletedAt: null,
    description: "",
    dueAt: null,
    gateName: null,
    id,
    labels: [],
    parentTaskId,
    position: 0,
    priority: "medium",
    projectId: null,
    recurrenceOccurrenceAt: null,
    recurrenceRule: null,
    recurrenceSequence: null,
    recurrenceSeriesId: null,
    recurrenceTimezone: null,
    startAt: null,
    status: "open",
    subquestCount: 0,
    title: `Quest ${id}`,
    version: 1,
  }
}

function CompletionUnmountHarness() {
  const [visible, setVisible] = useState(true)
  const showCompletion = useTaskCompletionCelebration()

  if (!visible) return <p>Completion source unmounted</p>

  return (
    <button
      onClick={() => {
        showCompletion({
          id: "last-task",
          title: "Last visible task",
          version: 2,
          xpEarned: 50,
        })
        setVisible(false)
      }}
      type="button"
    >
      Complete last task
    </button>
  )
}

describe("Quest organisation controls", () => {
  it("keeps the completion celebration mounted after its source unmounts", async () => {
    const user = userEvent.setup()

    render(
      <TaskCompletionCelebrationProvider>
        <CompletionUnmountHarness />
      </TaskCompletionCelebrationProvider>,
    )

    await user.click(screen.getByRole("button", { name: "Complete last task" }))

    expect(screen.getByText("Completion source unmounted")).toBeVisible()
    expect(screen.getByText("Task complete!")).toBeVisible()
    expect(screen.getByText("Momentum gained")).toBeVisible()
    expect(screen.getByText("+50 XP")).toBeVisible()
  })

  it("opens the XP celebration after completing a Today task", async () => {
    questActions.completeQuestAction.mockResolvedValue({
      data: {
        id: "today-task",
        progression: { totalXp: 35, xpDelta: 35 },
        version: 2,
      },
      ok: true,
    })
    const user = userEvent.setup()

    render(
      <TaskCompletionCelebrationProvider>
        <TodayTasks
          empty={false}
          sections={[
            {
              cards: [
                {
                  id: "today-task",
                  priority: "high",
                  status: "open" as const,
                  steps: 0,
                  timeLabel: "Anytime",
                  title: "Morning workout",
                  version: 1,
                },
              ],
              title: "My tasks",
            },
          ]}
        />
      </TaskCompletionCelebrationProvider>,
    )

    expect(screen.getByText("high", { exact: true })).toBeVisible()
    expect(screen.getByRole("article")).toHaveAttribute("data-priority", "high")

    await user.click(
      screen.getByRole("button", { name: "Clear Morning workout" }),
    )

    expect(await screen.findByText("Task complete!")).toBeVisible()
    expect(screen.getByText("Momentum gained")).toBeVisible()
    expect(screen.getByText("+35 XP")).toBeVisible()
  })

  it("opens the streak celebration when completion grows the streak", async () => {
    questActions.completeQuestAction.mockResolvedValue({
      data: {
        id: "streak-task",
        progression: {
          currentStreak: 5,
          rank: "E",
          rankAdvanced: false,
          streakIncreased: true,
          timezone: "UTC",
          totalXp: 70,
          xpDelta: 35,
        },
        version: 2,
      },
      ok: true,
    })
    const user = userEvent.setup()

    render(
      <TaskCompletionCelebrationProvider>
        <TodayTasks
          empty={false}
          sections={[
            {
              cards: [
                {
                  id: "streak-task",
                  priority: "high",
                  status: "open" as const,
                  steps: 0,
                  timeLabel: "Anytime",
                  title: "Keep the streak alive",
                  version: 1,
                },
              ],
              title: "My tasks",
            },
          ]}
        />
      </TaskCompletionCelebrationProvider>,
    )

    await user.click(
      screen.getByRole("button", { name: "Clear Keep the streak alive" }),
    )

    expect(
      await screen.findByRole("dialog", { name: "5 days strong" }),
    ).toBeVisible()
    expect(screen.getByText("New streak reached")).toBeVisible()
    expect(screen.getByText("+35 XP")).toBeVisible()
    expect(screen.queryByText("Task complete!")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Keep going" })).toBeVisible()
  })

  it("opens the current streak celebration from the Home streak button", async () => {
    const user = userEvent.setup()

    render(
      <TaskCompletionCelebrationProvider>
        <StreakButton streak={4} />
      </TaskCompletionCelebrationProvider>,
    )

    await user.click(screen.getByRole("button", { name: "View 4 day streak" }))

    expect(screen.getByRole("dialog", { name: "4 days strong" })).toBeVisible()
    expect(screen.getByText("Your current streak")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Undo completion" }),
    ).not.toBeInTheDocument()
  })

  it("keeps a missed Today task visible until it is moved to Trash", async () => {
    questActions.softDeleteQuestAction.mockResolvedValue({
      data: { id: "expired-task", version: 3 },
      ok: true,
    })
    const user = userEvent.setup()

    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                dueAt: "2020-01-01T10:00:00.000Z",
                id: "expired-task",
                priority: "medium",
                status: "failed",
                steps: 0,
                timeLabel: "Yesterday · 2:00 PM – 3:30 PM",
                title: "Expired task",
                version: 2,
              },
            ],
            title: "My tasks",
          },
        ]}
      />,
    )

    expect(await screen.findByText("Missed")).toBeVisible()
    expect(screen.getByRole("article")).toHaveAttribute("data-status", "failed")
    const discard = screen.getByRole("button", {
      name: "Move missed task Expired task to Trash",
    })
    expect(discard).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Clear Expired task" }),
    ).not.toBeInTheDocument()

    await user.click(discard)
    expect(questActions.softDeleteQuestAction).toHaveBeenCalledWith({
      expectedVersion: 2,
      questId: "expired-task",
    })
    expect(screen.queryByRole("article")).not.toBeInTheDocument()
    expect(
      screen.getByRole("dialog", { name: "Moved to Trash" }),
    ).toHaveTextContent("Expired task")
  })

  it("reveals and deletes an unneeded active Today task without a penalty", async () => {
    questActions.softDeleteQuestAction.mockResolvedValue({
      data: {
        id: "unneeded-task",
        progression: { totalXp: 35, xpDelta: 0 },
        version: 2,
      },
      ok: true,
    })
    const user = userEvent.setup()

    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                id: "unneeded-task",
                priority: "medium",
                status: "open",
                steps: 0,
                timeLabel: "7:30 PM – 9:30 PM",
                title: "No longer needed",
                version: 1,
              },
            ],
            title: "My tasks",
          },
        ]}
      />,
    )

    const task = screen.getByRole("article", { name: "No longer needed" })
    const deleteTask = screen.getByRole("button", {
      name: "Move No longer needed to Trash",
    })
    expect(
      screen.getByRole("button", { name: "Clear No longer needed" }),
    ).toBeVisible()

    await user.tab()
    await user.tab()
    expect(deleteTask).toHaveFocus()
    expect(task.parentElement).toHaveAttribute("data-actions-open", "true")

    await user.click(deleteTask)
    expect(questActions.softDeleteQuestAction).toHaveBeenCalledWith({
      expectedVersion: 1,
      questId: "unneeded-task",
    })
    expect(screen.queryByRole("article")).not.toBeInTheDocument()
    expect(
      screen.getByRole("dialog", { name: "Moved to Trash" }),
    ).toHaveTextContent("No points were deducted")
  })

  it("reopens a task when completion is undone", async () => {
    questActions.reopenQuestAction.mockResolvedValue({
      data: {
        id: "completed-task",
        progression: { totalXp: 0, xpDelta: -35 },
        version: 3,
      },
      ok: true,
    })
    const user = userEvent.setup()

    render(
      <TaskCompletedPopup
        onDismiss={vi.fn()}
        task={{
          id: "completed-task",
          title: "Morning workout",
          version: 2,
          xpEarned: 35,
        }}
      />,
    )

    expect(screen.getByText("+35 XP")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Undo completion" }))

    await waitFor(() =>
      expect(questActions.reopenQuestAction).toHaveBeenCalledWith({
        expectedVersion: 2,
        questId: "completed-task",
      }),
    )
    expect(await screen.findByText("Completion undone")).toBeVisible()
  })

  it("undoes a newly created task from the centered confirmation", async () => {
    questActions.softDeleteQuestAction.mockResolvedValue({
      data: { id: "new-task", version: 2 },
      ok: true,
    })
    const user = userEvent.setup()

    render(
      <TaskCreatedPopup
        onDismiss={vi.fn()}
        task={{ id: "new-task", title: "Morning walk", version: 1 }}
      />,
    )

    expect(screen.getByText("Task created!")).toBeVisible()
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/today?task=new-task",
    )
    expect(navigation.prefetch).toHaveBeenCalledWith("/today?task=new-task")
    await user.click(screen.getByRole("button", { name: "Undo creation" }))

    await waitFor(() =>
      expect(questActions.softDeleteQuestAction).toHaveBeenCalledWith({
        expectedVersion: 1,
        questId: "new-task",
      }),
    )
    expect(await screen.findByText("Creation undone")).toBeVisible()
  })

  it("keeps creation off the list and returns to the current Home day", async () => {
    let finishCreation: (() => void) | undefined
    questActions.createQuestAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCreation = () =>
            resolve({ data: { id: "created-task", version: 1 }, ok: true })
        }),
    )
    const user = userEvent.setup()

    render(
      <QuestActiveBoard
        attachmentsByQuest={{}}
        deletedQuests={[]}
        emptyDescription="Try a different search"
        emptyTitle="No matching tasks"
        filters={defaultQuestFilters}
        gates={[]}
        isFiltered={false}
        labels={[]}
        parentOptions={[]}
        quests={[]}
        storageAvailable
        timezone="UTC"
      />,
    )

    await user.type(screen.getByLabelText("Task title"), "Invisible draft")
    await user.click(screen.getByRole("button", { name: "Create Task" }))

    expect(screen.getByRole("button", { name: "Creating Task" })).toBeDisabled()
    expect(
      screen.queryByRole("article", { name: "Invisible draft" }),
    ).not.toBeInTheDocument()

    finishCreation?.()
    const createdDialog = await screen.findByRole("dialog", {
      name: "Task created!",
    })
    expect(createdDialog).toBeVisible()
    expect(
      within(createdDialog).getByRole("link", { name: "Continue" }),
    ).toHaveAttribute("href", "/today?task=created-task")
  })

  it("keeps Search empty until a query is entered and then shows only matches", async () => {
    questActions.permanentlyDeleteQuestAction.mockResolvedValue({
      data: { id: "recoverable", version: 2 },
      ok: true,
    })
    questActions.restoreQuestWithScheduleAction.mockResolvedValue({
      data: { id: "recoverable", version: 2 },
      ok: true,
    })
    const user = userEvent.setup()

    render(
      <QuestActiveBoard
        attachmentsByQuest={{}}
        deletedQuests={[
          {
            ...quest("recoverable"),
            deletedAt: "2026-08-13T09:00:00.000Z",
          },
        ]}
        emptyDescription="Try a different search"
        emptyTitle="No matching tasks"
        filters={defaultQuestFilters}
        gates={[]}
        isFiltered={false}
        labels={[]}
        parentOptions={[]}
        quests={[quest("hidden-until-search"), quest("unrelated-task")]}
        referenceNow="2026-08-13T12:00:00.000Z"
        storageAvailable
        timezone="UTC"
      />,
    )

    await user.click(screen.getByRole("tab", { name: /Search/i }))

    expect(screen.getByText("Search for a task")).toBeVisible()
    expect(
      screen.queryByText("Quest hidden-until-search"),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Quest unrelated-task")).not.toBeInTheDocument()

    await user.type(screen.getByRole("searchbox", { name: "Search" }), "hidden")
    expect(screen.getByText("Quest hidden-until-search")).toBeVisible()
    expect(screen.queryByText("Quest unrelated-task")).not.toBeInTheDocument()
    expect(screen.getByText("Search result")).toBeVisible()
    expect(
      screen.getByRole("button", {
        name: "Complete Quest hidden-until-search",
      }),
    ).toBeVisible()

    await user.click(screen.getByRole("tab", { name: /Trash/i }))
    expect(screen.getByText("Quest recoverable")).toBeVisible()
    expect(screen.getByText("Ready to recover")).toBeVisible()
    expect(screen.getByText("Restorable until midnight")).toBeVisible()
    expect(screen.getByText(/Moved to Trash/u)).toBeVisible()
    expect(screen.getByRole("button", { name: "Restore Task" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Delete Task" })).toBeVisible()

    const trashCard = screen.getByRole("article", {
      name: "Quest recoverable",
    })
    expect(trashCard).toHaveClass("trash-task-card")
    expect(
      within(trashCard).getByText(
        "Restore with a new timeline or remove this task permanently.",
      ),
    ).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Delete Task" }))
    const deleteDialog = screen.getByRole("alertdialog", {
      name: "Delete this task forever?",
    })
    expect(deleteDialog).toHaveClass("permanent-delete-dialog")
    expect(deleteDialog).toHaveTextContent("This cannot be undone")
    expect(deleteDialog).toHaveTextContent("cannot be restored")
    await user.click(
      within(deleteDialog).getByRole("button", { name: "Delete forever" }),
    )
    expect(questActions.permanentlyDeleteQuestAction).toHaveBeenCalledWith({
      expectedVersion: 1,
      questId: "recoverable",
    })
    const deletedPopup = await screen.findByRole("dialog", {
      name: "Task deleted",
    })
    expect(deletedPopup).toHaveTextContent("Clean slate")
    expect(deletedPopup).toHaveTextContent("Quest recoverable")
    expect(deletedPopup).toHaveTextContent("can no longer be restored")
    await user.click(
      within(deletedPopup).getByRole("button", { name: "Continue" }),
    )

    await user.click(screen.getByRole("button", { name: "Restore Task" }))
    const restoreTimeline = screen.getByRole("alertdialog", {
      name: "Set a new timeline",
    })
    const restoreForm = within(restoreTimeline)
    expect(restoreTimeline).toBeVisible()
    expect(restoreForm.getByLabelText("Start date · UTC")).toHaveTextContent(
      "13 Aug 2026",
    )
    expect(restoreForm.getByLabelText("Start time · UTC")).toHaveTextContent(
      "12:15",
    )
    expect(restoreForm.getByLabelText("Due date · UTC")).toHaveTextContent(
      "13 Aug 2026",
    )
    expect(restoreForm.getByLabelText("Due time · UTC")).toHaveTextContent(
      "13:15",
    )
    await user.click(restoreForm.getByLabelText("Start date · UTC"))
    expect(screen.getByText("Select a date")).toBeVisible()
    await user.keyboard("{Escape}")
    await user.click(
      screen.getByRole("button", { name: "Restore with new time" }),
    )
    expect(questActions.restoreQuestWithScheduleAction).toHaveBeenCalledWith({
      dueAt: "2026-08-13T13:15",
      expectedVersion: 1,
      questId: "recoverable",
      startAt: "2026-08-13T12:15",
    })
    expect(await screen.findByText("Task restored!")).toBeVisible()
    expect(screen.getByText("Back in motion")).toBeVisible()
    expect(screen.getByRole("dialog")).toHaveTextContent("Quest recoverable")
  })

  it("keeps an expired task deletable after its restore window closes", async () => {
    render(
      <QuestList
        emptyDescription="Trash is empty"
        emptyTitle="Trash is empty"
        mode="deleted"
        quests={[
          {
            ...quest("expired-copy"),
            deletedAt: "2026-08-12T09:00:00.000Z",
          },
        ]}
        referenceNow="2026-08-13T12:00:00.000Z"
        timezone="UTC"
      />,
    )

    expect(screen.getByText("Recovery expired")).toBeVisible()
    expect(screen.getByText("Restore window expired")).toBeVisible()
    expect(
      screen.getByText(
        "This task can still be permanently removed from Trash.",
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Restore Task" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete Task" })).toBeVisible()
  })

  it("shows a direct Create task action on an empty current Home", () => {
    render(<TodayTasks empty sections={[]} />)

    expect(screen.getByRole("link", { name: "Create task" })).toHaveAttribute(
      "href",
      "/quests",
    )
  })

  it("keeps notes off the task front and exposes an accessible flip control", async () => {
    const user = userEvent.setup()
    const description =
      "Bring the draft, review the open questions, and capture next steps."

    render(
      <TodayTasks
        empty={false}
        sections={[
          {
            cards: [
              {
                description,
                id: "task-with-note",
                priority: "medium",
                status: "open",
                steps: 0,
                timeLabel: "5:00 PM – 6:00 PM",
                title: "Planning session",
                version: 1,
              },
              {
                id: "task-without-note",
                priority: "low",
                status: "open",
                steps: 0,
                timeLabel: "Anytime",
                title: "Quick task",
                version: 1,
              },
            ],
            title: "My tasks",
          },
        ]}
      />,
    )

    expect(
      screen.getByRole("button", {
        name: "View description for Planning session",
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", {
        name: /View description for Quick task/u,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Return to Planning session" }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: "View description for Planning session",
      }),
    )

    expect(
      screen.getByRole("article", { name: "Planning session description" }),
    ).toBeVisible()
    expect(screen.getByText(description)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Return to Planning session" }),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Clear Planning session" }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Return to Planning session" }),
    )

    expect(
      screen.getByRole("article", { name: "Planning session" }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Clear Planning session" }),
    ).toBeVisible()
  })

  it("focuses the exact Home task requested by a notification", async () => {
    render(
      <TodayTasks
        empty={false}
        focusedQuestId="notification-target"
        sections={[
          {
            cards: [
              {
                id: "notification-target",
                priority: "medium",
                status: "open",
                steps: 0,
                timeLabel: "5:00 PM – 6:00 PM",
                title: "Notification target",
                version: 1,
              },
              {
                id: "untouched-task",
                priority: "low",
                status: "open",
                steps: 0,
                timeLabel: "7:00 PM – 8:00 PM",
                title: "Untouched task",
                version: 1,
              },
            ],
            title: "My tasks",
          },
        ]}
      />,
    )

    const task = screen.getByRole("article", { name: "Notification target" })
    const untouchedTask = screen.getByRole("article", {
      name: "Untouched task",
    })
    await waitFor(() => expect(task).toHaveFocus())
    expect(task).toHaveAttribute("data-glowing", "true")
    expect(untouchedTask).toHaveAttribute("data-glowing", "false")
    expect(task).toHaveAttribute("id", "today-task-notification-target")
    await waitFor(() => expect(task).toHaveAttribute("data-glowing", "false"), {
      timeout: 1_500,
    })
  })

  it("removes notification focus after completing its Home task", async () => {
    const user = userEvent.setup()
    navigation.replace.mockClear()
    questActions.completeQuestAction.mockResolvedValue({
      data: {
        id: "notification-target",
        progression: { totalXp: 35, xpDelta: 35 },
        version: 2,
      },
      ok: true,
    })
    window.history.replaceState(
      null,
      "",
      "/today?date=2026-08-14&task=notification-target",
    )

    render(
      <TaskCompletionCelebrationProvider>
        <TodayTasks
          empty={false}
          focusedQuestId="notification-target"
          sections={[
            {
              cards: [
                {
                  id: "notification-target",
                  priority: "medium",
                  status: "open",
                  steps: 0,
                  timeLabel: "5:00 PM – 6:00 PM",
                  title: "Notification target",
                  version: 1,
                },
              ],
              title: "My tasks",
            },
          ]}
        />
      </TaskCompletionCelebrationProvider>,
    )

    await user.click(
      screen.getByRole("button", { name: "Clear Notification target" }),
    )

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/today?date=2026-08-14",
        { scroll: false },
      ),
    )
  })

  it("shows a historical Home task without a copy action", () => {
    render(
      <TodayTasks
        empty={false}
        historical
        sections={[
          {
            cards: [
              {
                id: "historical-copy",
                priority: "medium",
                status: "completed",
                steps: 0,
                timeLabel: "Anytime",
                title: "Historical work",
                version: 2,
              },
            ],
            title: "Completed",
          },
        ]}
      />,
    )

    expect(screen.getByLabelText("Historical work completed")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: /Create a copy/u }),
    ).not.toBeInTheDocument()
  })

  it("preserves archived Gate and unavailable parent selections", () => {
    render(
      <QuestFormFields
        defaults={{
          description: "",
          dueAt: null,
          gateName: "Archived Gate",
          parentTaskId: "00000000-0000-4000-8000-000000000001",
          priority: "medium",
          projectId: "00000000-0000-4000-8000-000000000002",
          startAt: null,
          title: "Filtered child",
        }}
        gates={[]}
        idPrefix="preserve"
        parentOptions={[]}
      />,
    )

    expect(screen.getByLabelText("List")).toHaveValue(
      "00000000-0000-4000-8000-000000000002",
    )
    expect(screen.getByRole("option", { name: "Archived Gate" })).toBeVisible()
    expect(screen.getByLabelText("Parent task")).toHaveValue(
      "00000000-0000-4000-8000-000000000001",
    )
  })

  it("applies schedule presets and keeps priority selection explicit", async () => {
    const user = userEvent.setup()

    render(
      <QuestFormFields idPrefix="schedule" timezone="UTC" variant="create" />,
    )

    await user.click(screen.getByLabelText("Critical"))
    expect(screen.getByLabelText("Critical")).toBeChecked()

    await user.click(screen.getByRole("button", { name: "Tomorrow · 9–5" }))
    const startDate = screen.getByLabelText("Start date · UTC")
    const startTime = screen.getByLabelText("Start time · UTC")
    const dueDate = screen.getByLabelText("Due date · UTC")
    const dueTime = screen.getByLabelText("Due time · UTC")
    expect(startDate).toHaveTextContent(/\d{4}$/u)
    expect(startTime).toHaveTextContent("09:00")
    expect(dueDate).toHaveTextContent(/\d{4}$/u)
    expect(dueTime).toHaveTextContent("17:00")

    await user.click(startTime)
    const exactTime = screen.getByLabelText("Start time · UTC exact value")
    fireEvent.change(exactTime, { target: { value: "" } })
    expect(exactTime).toHaveValue("")
    expect(startTime).toHaveTextContent("09:00")
    expect(screen.getByRole("button", { name: "Use time" })).toBeDisabled()
    expect(exactTime).toHaveAttribute("step", "60")
    fireEvent.change(exactTime, { target: { value: "09:03" } })
    expect(exactTime).toHaveValue("09:03")
    expect(startTime).toHaveTextContent("09:03")
    await user.click(screen.getByRole("button", { name: "Use time" }))
    expect(
      screen.queryByLabelText("Start time · UTC exact value"),
    ).not.toBeInTheDocument()

    await user.click(startDate)
    expect(screen.getByText("Select a date")).toBeVisible()
    expect(screen.getByRole("button", { name: "Clear date" })).toBeVisible()
    await user.keyboard("{Escape}")

    await user.click(screen.getByRole("button", { name: "Clear" }))
    expect(startDate).toHaveTextContent("Choose date")
    expect(startTime).toBeDisabled()
    expect(dueDate).toHaveTextContent("Choose date")
    expect(dueTime).toBeDisabled()
  })

  it("fades elapsed time choices while allowing any future minute", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <QuestTimePicker
        ariaLabel="Start time · UTC"
        disabled={false}
        id="future-time"
        minTime="12:00"
        onChange={onChange}
        value="12:07"
      />,
    )

    await user.click(screen.getByLabelText("Start time · UTC"))

    expect(
      screen.getByRole("button", { name: "11:45 AM · unavailable" }),
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "12:00 PM" })).toBeEnabled()

    const exactTime = screen.getByLabelText("Start time · UTC exact value")
    fireEvent.change(exactTime, { target: { value: "11:59" } })
    expect(screen.getByText("Choose 12:00 or later for today.")).toBeVisible()
    expect(screen.getByRole("button", { name: "Use time" })).toBeDisabled()
    fireEvent.change(exactTime, { target: { value: "12:08" } })
    expect(onChange).toHaveBeenCalledWith("12:08")
    expect(screen.getByRole("button", { name: "Use time" })).toBeEnabled()
  })

  it("does not offer another nesting level to a filtered grandchild", () => {
    const root = quest("root")
    const child = quest("child", root.id)
    const grandchild = quest("grandchild", child.id)

    render(
      <QuestList
        emptyDescription="No matches"
        emptyTitle="Empty"
        gates={[]}
        labels={[]}
        mode="active"
        parentOptions={[root, child, grandchild].map(
          ({ id, parentTaskId, title }) => ({ id, parentTaskId, title }),
        )}
        quests={[grandchild]}
      />,
    )

    expect(screen.queryByText("Add Subquest")).not.toBeInTheDocument()
  })

  it("shows unavailable URL filters instead of displaying misleading defaults", () => {
    render(
      <QuestFilterBar
        filters={{
          ...defaultQuestFilters,
          gateId: "00000000-0000-4000-8000-000000000003",
          labelId: "00000000-0000-4000-8000-000000000004",
        }}
        gates={[]}
        isFiltered
        labels={[]}
      />,
    )

    expect(screen.getByLabelText("List")).toHaveValue(
      "00000000-0000-4000-8000-000000000003",
    )
    expect(screen.getByLabelText("Label")).toHaveValue(
      "00000000-0000-4000-8000-000000000004",
    )
    expect(
      screen.getByRole("option", { name: "Unavailable list" }),
    ).toBeVisible()
    expect(
      screen.getByRole("option", { name: "Unavailable Label" }),
    ).toBeVisible()
  })

  it("offers keyboard/touch ordering and sends optimistic versions", async () => {
    questActions.reorderQuestsAction.mockResolvedValue({
      data: {
        quests: [
          { id: "second", version: 2 },
          { id: "first", version: 2 },
        ],
      },
      ok: true,
    })
    const user = userEvent.setup()
    render(
      <QuestList
        emptyDescription="No matches"
        emptyTitle="Empty"
        mode="active"
        quests={[quest("first"), quest("second")]}
        reorderable
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Move Quest second up" }),
    )
    await waitFor(() =>
      expect(questActions.reorderQuestsAction).toHaveBeenCalledWith({
        quests: [
          { expectedVersion: 1, questId: "second" },
          { expectedVersion: 1, questId: "first" },
        ],
      }),
    )
  })

  it("announces rollback when an optimistic reorder conflicts", async () => {
    questActions.reorderQuestsAction.mockResolvedValue({
      error: { code: "CONFLICT", message: "The Quest changed elsewhere." },
      ok: false,
    })
    const user = userEvent.setup()
    render(
      <QuestList
        emptyDescription="No matches"
        emptyTitle="Empty"
        mode="active"
        quests={[quest("first"), quest("second")]}
        reorderable
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Move Quest second up" }),
    )
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "The previous order was restored",
      ),
    )
  })
})
