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
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    window.sessionStorage.setItem(
      activeTimerStorageKey,
      "a8fdce72-19a7-4544-b863-50caa19373e7",
    )
    render(<TimerLifecycleBoundary />)

    document.dispatchEvent(new Event("visibilitychange"))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requests a stop when the document exits", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null)))
    vi.stubGlobal("fetch", fetchMock)
    window.sessionStorage.setItem(
      activeTimerStorageKey,
      "a8fdce72-19a7-4544-b863-50caa19373e7",
    )
    render(<TimerLifecycleBoundary />)

    window.dispatchEvent(new Event("pagehide"))

    expect(fetchMock).toHaveBeenCalledWith("/api/timer/stop", {
      body: JSON.stringify({
        sessionId: "a8fdce72-19a7-4544-b863-50caa19373e7",
      }),
      credentials: "same-origin",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      keepalive: true,
      method: "POST",
    })
  })
})
