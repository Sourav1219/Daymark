import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TimerRoute } from "@/features/timer/components/timer-route"
import type { TimerDashboardView } from "@/features/timer/domain/types"

const navigation = vi.hoisted(() => ({
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/timer",
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/features/timer/application/actions", () => ({
  editTimerSubjectAction: vi.fn(),
  pauseTimerAction: vi.fn(),
  resumeTimerAction: vi.fn(),
  startTimerAction: vi.fn(),
  stopTimerAction: vi.fn(),
}))

vi.mock("@/features/timer/components/group-study-panel", () => ({
  GroupStudyPanel: () => <div data-testid="group-study-panel" />,
}))

const baseDashboard: TimerDashboardView = {
  activeSession: null,
  completedCount: 2,
  history: [],
  localDate: "2026-09-05",
  pendingJoinRequest: null,
  serverNow: "2026-09-05T12:00:00.000Z",
  sharedHistory: [],
  sharedSession: null,
  timezone: "UTC",
  totalCompletedMs: 3600000,
}

describe("TimerRoute interval modes", () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders all four interval presets with Pomodoro selected by default", () => {
    render(<TimerRoute initialDashboard={baseDashboard} />)

    expect(screen.getByRole("radio", { name: "25m Pomodoro" })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    expect(
      screen.getByRole("radio", { name: "50m Deep Work" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "5m Break" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Stopwatch" })).toBeInTheDocument()

    // Ready clock shows 00:25:00 for 25m Pomodoro
    expect(screen.getByRole("timer")).toHaveTextContent("00:25:00")
  })

  it("switches countdown display when selecting another preset", () => {
    render(<TimerRoute initialDashboard={baseDashboard} />)

    // Switch to 50m Deep Work
    fireEvent.click(screen.getByRole("radio", { name: "50m Deep Work" }))
    expect(screen.getByRole("timer")).toHaveTextContent("00:50:00")
    expect(
      screen.getByRole("button", { name: /Start 50m Deep Work/i }),
    ).toBeInTheDocument()

    // Switch to 5m Break
    fireEvent.click(screen.getByRole("radio", { name: "5m Break" }))
    expect(screen.getByRole("timer")).toHaveTextContent("00:05:00")
    expect(
      screen.getByRole("button", { name: /Start 5m Break/i }),
    ).toBeInTheDocument()

    // Switch to Stopwatch
    fireEvent.click(screen.getByRole("radio", { name: "Stopwatch" }))
    expect(screen.getByRole("timer")).toHaveTextContent("00:00:00")
    expect(
      screen.getByRole("button", { name: /Start Stopwatch/i }),
    ).toBeInTheDocument()
  })

  it("displays overtime banner when an active countdown exceeds its target", () => {
    // 25 min = 1,500,000 ms. If accumulatedMs is 1,600,000 ms, it's 100s overtime
    window.localStorage.setItem("traketo:timer-mode:active-1", "pomodoro")

    const activeDashboard: TimerDashboardView = {
      ...baseDashboard,
      activeSession: {
        accumulatedMs: 1600000,
        createdAt: "2026-09-05T12:00:00.000Z",
        endedAt: null,
        id: "active-1",
        lastStartedAt: "2026-09-05T12:00:00.000Z",
        startedAt: "2026-09-05T12:00:00.000Z",
        status: "running",
        subject: "Physics study",
        updatedAt: "2026-09-05T12:26:40.000Z",
        version: 1,
      },
    }

    render(<TimerRoute initialDashboard={activeDashboard} />)

    // Expect overtime status and banner
    expect(screen.getByText("Overtime")).toBeInTheDocument()
    expect(screen.getByText("Target interval reached!")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Take 5m break/i }),
    ).toBeInTheDocument()
  })
})
