import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ACTIVE_SESSIONS_CHANGED_EVENT } from "@/features/authentication/client/session-events"

import { SecurityDataPanel } from "./security-data-panel"

const mocks = vi.hoisted(() => ({
  listActiveSessionsAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

vi.mock(
  "@/features/authentication/application/account-security-actions",
  () => ({
    confirmTwoFactorAction: vi.fn(async () => null),
    deleteAccountAction: vi.fn(async () => null),
    disableTwoFactorAction: vi.fn(async () => null),
    enableTwoFactorAction: vi.fn(async () => null),
    exportAccountDataAction: vi.fn(async () => null),
    listActiveSessionsAction: mocks.listActiveSessionsAction,
    revokeSessionAction: vi.fn(async () => ({
      data: { revoked: true },
      ok: true,
    })),
    signOutEverywhereAction: vi.fn(async () => ({
      data: { signedOut: true },
      ok: true,
    })),
  }),
)

vi.mock("@/features/offline/storage/offline-database", () => ({
  clearPrivateOfflineData: vi.fn(async () => undefined),
}))

const macSession = {
  createdAt: "2026-08-27T18:00:00.000Z",
  expiresAt: "2026-09-03T18:00:00.000Z",
  id: "mac-session",
  ipAddress: null,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0 Safari/537.36",
} as const

const phoneSession = {
  createdAt: "2026-08-27T18:30:00.000Z",
  expiresAt: "2026-09-03T18:30:00.000Z",
  id: "phone-session",
  ipAddress: null,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605.1.15",
} as const

describe("SecurityDataPanel sessions", () => {
  beforeEach(() => {
    mocks.listActiveSessionsAction.mockReset()
    mocks.push.mockReset()
    mocks.refresh.mockReset()
  })

  it("updates the device list when another device changes the account sessions", async () => {
    mocks.listActiveSessionsAction.mockResolvedValue({
      data: [macSession, phoneSession],
      ok: true,
    })
    render(
      <SecurityDataPanel
        currentSessionId={macSession.id}
        initialSessions={[macSession]}
      />,
    )

    expect(screen.getByText("Chrome on macOS")).toBeInTheDocument()
    expect(screen.queryByText("Safari on iPhone")).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new Event(ACTIVE_SESSIONS_CHANGED_EVENT)))

    await waitFor(() => {
      expect(screen.getByText("Safari on iPhone")).toBeInTheDocument()
    })
    expect(mocks.listActiveSessionsAction).toHaveBeenCalledOnce()
  })

  it("excludes localhost sign-in tracks from active sessions", () => {
    const localhostSession1 = {
      createdAt: "2026-08-27T19:00:00.000Z",
      expiresAt: "2026-09-03T19:00:00.000Z",
      id: "local-session-1",
      ipAddress: "127.0.0.1",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0 Safari/537.36",
    }
    const localhostSession2 = {
      createdAt: "2026-08-27T19:30:00.000Z",
      expiresAt: "2026-09-03T19:30:00.000Z",
      id: "local-session-2",
      ipAddress: "0000:0000:0000:0000:0000:0000:0000:0000",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0 Safari/537.36",
    }
    const realSession = {
      createdAt: "2026-08-27T20:00:00.000Z",
      expiresAt: "2026-09-03T20:00:00.000Z",
      id: "real-session",
      ipAddress: "128.185.168.217",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0 Safari/537.36",
    }

    render(
      <SecurityDataPanel
        currentSessionId={realSession.id}
        initialSessions={[localhostSession1, localhostSession2, realSession]}
      />,
    )

    // Heading should only count the 1 real session
    const sessionsHeading = screen.getByRole("heading", {
      name: "Active sessions",
    })
    expect(
      sessionsHeading.parentElement?.querySelector("span"),
    ).toHaveTextContent("1")

    // The real session is shown
    expect(screen.getByText("Chrome on macOS")).toBeInTheDocument()
    expect(screen.getByText("128.185.168.217")).toBeInTheDocument()

    // Localhost sessions are not rendered
    expect(screen.queryByText("127.0.0.1")).not.toBeInTheDocument()
    expect(
      screen.queryByText("0000:0000:0000:0000:0000:0000:0000:0000"),
    ).not.toBeInTheDocument()
  })
})
