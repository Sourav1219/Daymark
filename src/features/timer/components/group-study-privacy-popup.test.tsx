import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GroupStudyPrivacyPopup } from "./group-study-privacy-popup"

describe("GroupStudyPrivacyPopup", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders enabled state with title, copy, and closes on button click", async () => {
    const onDismiss = vi.fn()
    const { getByRole, getByText } = render(
      <GroupStudyPrivacyPopup
        notice={{ enabled: true }}
        onDismiss={onDismiss}
      />,
    )

    expect(getByText("Privacy mode on!")).toBeDefined()
    expect(
      getByText(
        "All room and participant subjects are now masked as “Focusing”.",
      ),
    ).toBeDefined()
    expect(getByText("🔒 Showing “Focusing”")).toBeDefined()

    const button = getByRole("button", { name: /Got it/i })
    await act(async () => {
      button.click()
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("renders disabled state with title and copy", () => {
    const onDismiss = vi.fn()
    const { getByText } = render(
      <GroupStudyPrivacyPopup
        notice={{ enabled: false }}
        onDismiss={onDismiss}
      />,
    )

    expect(getByText("Subjects visible!")).toBeDefined()
    expect(
      getByText("Room and participant study subjects are now visible."),
    ).toBeDefined()
    expect(getByText("👁️ Study subjects visible")).toBeDefined()
  })

  it("auto-dismisses after timeout", async () => {
    const onDismiss = vi.fn()
    render(
      <GroupStudyPrivacyPopup
        notice={{ enabled: true }}
        onDismiss={onDismiss}
      />,
    )

    expect(onDismiss).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("dismisses on Escape key", async () => {
    const onDismiss = vi.fn()
    render(
      <GroupStudyPrivacyPopup
        notice={{ enabled: true }}
        onDismiss={onDismiss}
      />,
    )

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
