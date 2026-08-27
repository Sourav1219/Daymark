import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SessionWatcher } from "./session-watcher"

const mocks = vi.hoisted(() => ({
  clearPrivateOfflineData: vi.fn(async () => undefined),
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}))

vi.mock("@/features/offline/storage/offline-database", () => ({
  clearPrivateOfflineData: mocks.clearPrivateOfflineData,
}))

type EventListener = (event: Event) => void

class FakeEventSource {
  static instances: FakeEventSource[] = []

  readonly listeners = new Map<string, Set<EventListener>>()
  onerror: (() => void) | null = null

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  close() {}

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type))
    }
  }
}

describe("SessionWatcher", () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    mocks.clearPrivateOfflineData.mockClear()
    mocks.replace.mockClear()
    vi.stubGlobal("EventSource", FakeEventSource)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the signed-out screen immediately when another device revokes the session", async () => {
    render(<SessionWatcher />)

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    expect(FakeEventSource.instances[0]?.url).toBe("/api/session/events")

    act(() => FakeEventSource.instances[0]?.emit("session-revoked"))

    expect(
      screen.getByRole("heading", {
        name: "This device has been signed out.",
      }),
    ).toBeInTheDocument()
    expect(mocks.replace).toHaveBeenCalledWith("/unauthorized")
    expect(mocks.clearPrivateOfflineData).toHaveBeenCalledOnce()
  })
})
