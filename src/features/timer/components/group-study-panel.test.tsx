import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { GroupStudySessionView } from "@/features/timer/domain/types"

import { GroupStudyPanel } from "./group-study-panel"

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

class EventSourceStub {
  static readonly CLOSED = 2
  static readonly CONNECTING = 0
  static readonly OPEN = 1

  static instances: EventSourceStub[] = []

  onerror: ((event: Event) => void) | null = null
  onopen: ((event: Event) => void) | null = null
  readyState = EventSourceStub.CONNECTING

  constructor(readonly url: string) {
    EventSourceStub.instances.push(this)
  }

  addEventListener() {}

  close() {
    this.readyState = EventSourceStub.CLOSED
  }
}

const sharedSession: GroupStudySessionView = {
  activities: [],
  createdAt: "2026-09-09T10:00:00.000Z",
  id: "01991f54-a6d7-7000-8000-000000000001",
  isHost: true,
  joinCode: "TRACK1",
  joinLocked: false,
  joinRequests: [],
  name: "Focus room",
  participantLimit: 8,
  participants: [
    {
      accumulatedMs: 0,
      id: "01991f54-a6d7-7000-8000-000000000002",
      isCurrentUser: true,
      isHost: true,
      joinedAt: "2026-09-09T10:00:00.000Z",
      lastStartedAt: "2026-09-09T10:00:00.000Z",
      name: "Test User",
      status: "running",
      subject: "Review",
      timerSessionId: "01991f54-a6d7-7000-8000-000000000003",
      userId: "01991f54-a6d7-7000-8000-000000000004",
    },
  ],
  subject: "Review",
  version: 1,
}

function renderPanel() {
  return render(
    <GroupStudyPanel
      hasActiveTimer={true}
      nowMs={Date.parse("2026-09-09T10:01:00.000Z")}
      onTimerStarted={vi.fn()}
      pendingJoinRequest={null}
      sharedHistory={[]}
      sharedSession={sharedSession}
      timezone="UTC"
    />,
  )
}

function groupPollCalls() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([input]) => String(input).includes("/group-poll"))
}

describe("GroupStudyPanel realtime fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    EventSourceStub.instances = []
    mocks.refresh.mockClear()
    vi.stubGlobal("EventSource", EventSourceStub)
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/group-poll")
          ? Response.json({
              activityCount: 0,
              joinRequestCount: 0,
              participantCount: 1,
              status: "active",
              version: 1,
            })
          : new Response(null, { status: 204 }),
      ),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("does not poll the database while realtime is connected", async () => {
    renderPanel()
    const events = EventSourceStub.instances[0]

    await act(async () => {
      if (!events) throw new Error("EventSource was not created")
      events.readyState = EventSourceStub.OPEN
      events.onopen?.(new Event("open"))
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(groupPollCalls()).toHaveLength(0)
  })

  it("starts polling only when realtime is unavailable", async () => {
    renderPanel()
    const events = EventSourceStub.instances[0]

    await act(async () => {
      if (!events) throw new Error("EventSource was not created")
      events.readyState = EventSourceStub.CLOSED
      events.onerror?.(new Event("error"))
      await Promise.resolve()
    })
    expect(groupPollCalls()).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(groupPollCalls()).toHaveLength(2)
  })

  it("falls back after three seconds when realtime never opens", async () => {
    renderPanel()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(groupPollCalls()).toHaveLength(1)
  })

  it("toggles privacy mode to mask subjects as 'Focusing' and shows celebration popup", async () => {
    const {
      getAllByRole,
      getAllByText,
      getByRole,
      getByText,
      queryAllByText,
      queryByRole,
    } = renderPanel()

    // Initially displays the actual subject "Review" for room and participant
    expect(getByText("Focus room")).toBeDefined()
    expect(getAllByText("Review").length).toBe(2)
    expect(queryByRole("dialog")).toBeNull()

    // Find and click the privacy toggle to enable
    const privacyButtons = getAllByRole("button", {
      name: /Enable privacy mode/i,
    })
    expect(privacyButtons.length).toBeGreaterThanOrEqual(1)

    await act(async () => {
      privacyButtons[0]?.click()
    })

    // Masked mode shows "Focusing" instead of the private subject
    expect(queryAllByText("Review")).toHaveLength(0)

    // Animated celebration popup is visible in the middle of the screen
    const popupDialog = getByRole("dialog")
    expect(popupDialog).toBeDefined()
    expect(getByText("Privacy mode on!")).toBeDefined()
    expect(
      getByText(
        "All room and participant subjects are now masked as “Focusing”.",
      ),
    ).toBeDefined()

    // Dismiss the enabled popup
    const gotItButton = getByRole("button", { name: /Got it/i })
    await act(async () => {
      gotItButton.click()
    })
    expect(queryByRole("dialog")).toBeNull()

    // Click toggle again to disable privacy mode
    const disableButtons = getAllByRole("button", {
      name: /Disable privacy mode/i,
    })
    expect(disableButtons.length).toBeGreaterThanOrEqual(1)

    await act(async () => {
      disableButtons[0]?.click()
    })

    // Original subjects restored
    expect(getAllByText("Review").length).toBe(2)

    // Animated celebration popup is visible for disabled state
    expect(getByRole("dialog")).toBeDefined()
    expect(getByText("Subjects visible!")).toBeDefined()
    expect(
      getByText("Room and participant study subjects are now visible."),
    ).toBeDefined()

    // Dismiss the disabled popup
    const dismissDisabledButton = getByRole("button", { name: /Got it/i })
    await act(async () => {
      dismissDisabledButton.click()
    })
    expect(queryByRole("dialog")).toBeNull()
  })
})
