import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  activeTimerStorageKey,
  TimerLifecycleBoundary,
} from "@/features/timer/components/timer-lifecycle-boundary"

describe("TimerLifecycleBoundary", () => {
  afterEach(() => {
    window.sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it("does not stop a timer when the tab merely becomes hidden", () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal("navigator", { ...navigator, sendBeacon })
    window.sessionStorage.setItem(
      activeTimerStorageKey,
      "a8fdce72-19a7-4544-b863-50caa19373e7",
    )
    render(<TimerLifecycleBoundary />)

    document.dispatchEvent(new Event("visibilitychange"))

    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it("requests a stop when the document exits", () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal("navigator", { ...navigator, sendBeacon })
    window.sessionStorage.setItem(
      activeTimerStorageKey,
      "a8fdce72-19a7-4544-b863-50caa19373e7",
    )
    render(<TimerLifecycleBoundary />)

    window.dispatchEvent(new Event("pagehide"))

    expect(sendBeacon).toHaveBeenCalledWith(
      "/api/timer/stop",
      JSON.stringify({
        sessionId: "a8fdce72-19a7-4544-b863-50caa19373e7",
      }),
    )
  })
})
