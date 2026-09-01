import { useState, type AnchorHTMLAttributes } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TodayHeader } from "./today-header"

type MockLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href:
    | string
    | Readonly<{
        pathname: string
        query: Readonly<Record<string, string>>
      }>
  onNavigate?: () => void
  prefetch?: boolean
}

vi.mock("next/link", () => ({
  default: ({ href, onNavigate, prefetch, ...props }: MockLinkProps) => {
    const serializedHref =
      typeof href === "string"
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query)}`

    return (
      <a
        {...props}
        data-prefetch={prefetch}
        href={serializedHref}
        onClick={(event) => {
          event.preventDefault()
          onNavigate?.()
        }}
      />
    )
  },
}))

vi.mock("@/features/progression/components/streak-button", () => ({
  StreakButton: () => null,
}))

vi.mock("@/features/reminders/components/notification-menu", () => ({
  NotificationMenu: () => null,
}))

const baseProps = {
  inbox: { dueSoonQuests: [] },
  referenceNow: "2026-09-01T12:00:00.000Z",
  selectedDate: "2026-09-01",
  streak: 0,
  timezone: "UTC",
  todayDate: "2026-09-01",
} as const

describe("TodayHeader", () => {
  it("updates the visible calendar immediately and fully prefetches dates", async () => {
    const user = userEvent.setup()
    function ControlledHeader() {
      const [selectedDate, setSelectedDate] = useState<string>(
        baseProps.selectedDate,
      )
      return (
        <TodayHeader
          {...baseProps}
          onDateNavigate={setSelectedDate}
          selectedDate={selectedDate}
        />
      )
    }

    render(<ControlledHeader />)

    const previous = screen.getByRole("link", { name: "Previous day" })
    expect(previous).toHaveAttribute("data-prefetch", "true")

    await user.click(previous)

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mon, 31 Aug 2026",
    )
    expect(screen.getByRole("link", { current: "date" })).toHaveTextContent(
      "31",
    )
  })
})
