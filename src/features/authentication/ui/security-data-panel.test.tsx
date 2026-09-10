import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ACTIVE_SESSIONS_CHANGED_EVENT } from "@/features/authentication/client/session-events"

import { SecurityDataPanel } from "./security-data-panel"

const mocks = vi.hoisted(() => ({
  clearPrivateOfflineData: vi.fn(async () => undefined),
  disablePushNotifications: vi.fn(async () => true),
  enablePushNotifications: vi.fn(async () => true),
  getActivePushSubscription: vi.fn(
    async (): Promise<PushSubscription | null> => null,
  ),
  listActiveSessionsAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  supportsPushNotifications: vi.fn(() => true),
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
  clearPrivateOfflineData: mocks.clearPrivateOfflineData,
}))

vi.mock("@/features/reminders/components/automatic-push-enrollment", () => ({
  disablePushNotifications: mocks.disablePushNotifications,
  enablePushNotifications: mocks.enablePushNotifications,
  getActivePushSubscription: mocks.getActivePushSubscription,
  supportsPushNotifications: mocks.supportsPushNotifications,
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
  const requestPermission = vi.fn(
    async () => "granted" as NotificationPermission,
  )

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockClear())
    mocks.getActivePushSubscription.mockResolvedValue(null)
    mocks.supportsPushNotifications.mockReturnValue(true)
    requestPermission.mockClear()
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission,
    })
  })

  afterEach(() => vi.unstubAllGlobals())

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

  it("does not render export or delete account buttons on the Active Sessions tab", () => {
    render(
      <SecurityDataPanel
        currentSessionId={macSession.id}
        initialSessions={[macSession]}
      />,
    )

    expect(
      screen.getByRole("tab", { name: /active sessions/i }),
    ).toHaveAttribute("aria-selected", "true")
    expect(
      screen.queryByRole("heading", { name: "Export your data" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Delete account" }),
    ).not.toBeInTheDocument()
  })

  it("switches to Consent & Data tab and renders consent controls, data export, and delete account", async () => {
    render(
      <SecurityDataPanel
        currentSessionId={macSession.id}
        initialSessions={[macSession]}
      />,
    )

    const consentTab = screen.getByRole("tab", { name: /consent & data/i })
    act(() => {
      consentTab.click()
    })

    expect(consentTab).toHaveAttribute("aria-selected", "true")

    // Consent Controls
    expect(
      screen.getByRole("heading", { name: "Consent Controls" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 4, name: "Email Task Reminders" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 4, name: "Web Push Notifications" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "Encrypted Local Device Storage",
      }),
    ).toBeInTheDocument()

    // Explicit Consent given timestamps
    expect(
      screen.getByText(/Consent given: Aug 24, 2026 · 09:18 AM/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Consent given: Aug 24, 2026 · 10:04 AM/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Consent not granted/i)).toBeInTheDocument()

    // Cookies should NOT be here (they are separate)
    expect(screen.queryByText(/cookie preferences/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/optional preferences storage/i),
    ).not.toBeInTheDocument()

    // Consent Ledger belongs on Privacy Centre, not in profile settings
    expect(
      screen.queryByRole("heading", { name: "Consent Ledger" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("LEDGER-001")).not.toBeInTheDocument()

    // Export & Delete Account
    expect(
      screen.getByRole("heading", { name: "Export your data" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /request export/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Delete account" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /delete my account/i }),
    ).toBeInTheDocument()
  })

  it("updates all three switches directly with centered animated status feedback", async () => {
    const user = userEvent.setup()
    render(
      <SecurityDataPanel
        currentSessionId={macSession.id}
        initialSessions={[macSession]}
        pushPublicKey="test-public-key"
      />,
    )
    await user.click(screen.getByRole("tab", { name: /consent & data/i }))

    const email = screen.getByRole("checkbox", {
      name: "Toggle email reminders",
    })
    await user.click(email)
    await waitFor(() => expect(email).not.toBeChecked())
    expect(
      screen.getByRole("status", { name: "Email reminders Withdrawn" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await user.click(email)
    await waitFor(() => expect(email).toBeChecked())
    expect(
      screen.getByRole("status", { name: "Email reminders Enabled" }),
    ).toBeInTheDocument()

    const push = screen.getByRole("checkbox", {
      name: "Toggle web push notifications",
    })
    await user.click(push)
    await waitFor(() => expect(push).toBeChecked())
    expect(requestPermission).toHaveBeenCalledOnce()
    expect(mocks.enablePushNotifications).toHaveBeenCalledWith(
      "test-public-key",
    )
    expect(
      screen.getByRole("status", { name: "Web push Enabled" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await user.click(push)
    await waitFor(() => expect(push).not.toBeChecked())
    expect(mocks.disablePushNotifications).toHaveBeenCalledOnce()
    expect(
      screen.getByRole("status", { name: "Web push Withdrawn" }),
    ).toBeInTheDocument()

    const offline = screen.getByRole("checkbox", {
      name: "Toggle Encrypted Local Device Storage",
    })
    await user.click(offline)
    await waitFor(() => expect(offline).not.toBeChecked())
    expect(mocks.clearPrivateOfflineData).toHaveBeenCalledOnce()
    expect(
      screen.getByRole("status", { name: "Device storage Withdrawn" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await user.click(offline)
    await waitFor(() => expect(offline).toBeChecked())
    expect(
      screen.getByRole("status", { name: "Device storage Enabled" }),
    ).toBeInTheDocument()
  })

  it("shows withdrawn directly when browser permission is declined", async () => {
    const user = userEvent.setup()
    requestPermission.mockResolvedValueOnce("denied")
    render(
      <SecurityDataPanel
        currentSessionId={macSession.id}
        initialSessions={[macSession]}
        pushPublicKey="test-public-key"
      />,
    )
    await user.click(screen.getByRole("tab", { name: /consent & data/i }))

    const push = screen.getByRole("checkbox", {
      name: "Toggle web push notifications",
    })
    await user.click(push)
    await waitFor(() => expect(push).not.toBeChecked())
    expect(mocks.enablePushNotifications).not.toHaveBeenCalled()
    expect(
      screen.getByRole("status", { name: "Web push Withdrawn" }),
    ).toBeInTheDocument()
  })
})
