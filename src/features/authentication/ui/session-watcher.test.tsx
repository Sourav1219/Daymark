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

describe("SessionWatcher", () => {
  beforeEach(() => {
    mocks.clearPrivateOfflineData.mockClear()
    mocks.replace.mockClear()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the signed-out screen when the initial session check is revoked", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }))
    render(<SessionWatcher />)

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "This device has been signed out.",
        }),
      ).toBeInTheDocument()
    })
    expect(mocks.replace).toHaveBeenCalledWith("/sign-out?next=%2F")
    expect(mocks.clearPrivateOfflineData).toHaveBeenCalledOnce()
  })

  it("rechecks the session periodically without opening an event stream", async () => {
    vi.useFakeTimers()
    render(<SessionWatcher />)

    await act(async () => undefined)
    expect(fetch).toHaveBeenCalledOnce()

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1_000)
    })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(mocks.replace).toHaveBeenCalledWith("/sign-out?next=%2F")
    vi.useRealTimers()
  })
})
