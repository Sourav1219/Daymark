import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ReminderInboxPanel } from "@/features/reminders/components/notification-menu"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock("@/features/privacy/client/optional-browser-storage", () => ({
  cookieConsentChangedEvent: "traketo:cookie-consent-changed",
  hasPreferenceStorageConsent: () => false,
  readDeadlineStorageKey: "questly:read-deadline-alerts",
}))

const referenceNow = "2026-09-06T18:00:00.000Z"
const inbox = {
  dueSoonQuests: [
    {
      dueAt: "2026-09-06T18:10:00.000Z",
      id: "quest-one",
      title: "First task",
    },
    {
      dueAt: "2026-09-06T18:20:00.000Z",
      id: "quest-two",
      title: "Second task",
    },
  ],
}

describe("ReminderInboxPanel acknowledgements", () => {
  it("removes one notification when Mark read is clicked without storage consent", () => {
    render(
      <ReminderInboxPanel
        inbox={inbox}
        referenceNow={referenceNow}
        timezone="UTC"
      />,
    )

    const firstAlert = screen.getByRole("article", {
      name: "First task deadline alert",
    })
    fireEvent.click(
      within(firstAlert).getByRole("button", { name: "Mark read" }),
    )

    expect(firstAlert).not.toBeInTheDocument()
    expect(screen.getByText("Second task")).toBeVisible()
    expect(screen.getByText("1 unread alert")).toBeVisible()
  })

  it("removes all notifications when Mark all read is clicked without storage consent", () => {
    render(
      <ReminderInboxPanel
        inbox={inbox}
        referenceNow={referenceNow}
        timezone="UTC"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }))

    expect(screen.queryByRole("list", { name: "Reminder inbox" })).toBeNull()
    expect(screen.getByText("You're all caught up")).toBeVisible()
    expect(screen.getByText("No unread alerts")).toBeVisible()
  })
})
