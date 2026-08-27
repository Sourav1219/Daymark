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
    deleteAccountAction: vi.fn(async () => null),
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
})
