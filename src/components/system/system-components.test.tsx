import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ConfirmationDialog } from "./confirmation-dialog"
import { EmptyState } from "./empty-state"
import { ErrorState } from "./error-state"
import { PageHeading } from "./page-heading"
import { PageSkeleton } from "./page-skeleton"

describe("system states", () => {
  it("renders an announced page heading and designed empty state", () => {
    render(
      <>
        <PageHeading
          description="A route description"
          eyebrow="Today"
          title="Today"
        />
        <EmptyState
          description="Nothing is stored yet."
          title="Nothing here yet"
        />
      </>,
    )

    expect(
      screen.getByRole("heading", { level: 1, name: "Today" }),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { level: 2, name: "Nothing here yet" }),
    ).toBeVisible()
  })

  it("labels the loading state for assistive technology", () => {
    render(<PageSkeleton />)

    expect(screen.getByRole("status", { name: "Loading page" })).toBeVisible()
  })

  it("offers an explicit retry from the error state", async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<ErrorState onRetry={onRetry} />)

    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe("ConfirmationDialog", () => {
  it("requires confirmation before running the supplied callback", async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmationDialog
        confirmLabel="Confirm reset"
        description="Nothing is persisted."
        onConfirm={onConfirm}
        title="Reset preview?"
        triggerLabel="Open confirmation"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Open confirmation" }))
    expect(screen.getByRole("alertdialog")).toBeVisible()
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Confirm reset" }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
