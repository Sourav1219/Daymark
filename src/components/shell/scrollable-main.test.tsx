import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ScrollableMain } from "@/components/shell/scrollable-main"

const navigation = vi.hoisted(() => ({ bfcacheId: "profile-entry" }))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}))

describe("ScrollableMain", () => {
  beforeEach(() => {
    navigation.bfcacheId = `entry-${crypto.randomUUID()}`
  })

  it("restores its scroll position for a browser history entry", () => {
    const historyEntry = navigation.bfcacheId
    const firstRender = render(<ScrollableMain>Profile</ScrollableMain>)
    const main = screen.getByRole("main")

    main.scrollTop = 640
    fireEvent.scroll(main)
    firstRender.unmount()

    navigation.bfcacheId = historyEntry
    render(<ScrollableMain>Profile</ScrollableMain>)

    expect(screen.getByRole("main")).toHaveProperty("scrollTop", 640)
  })

  it("starts at the top for a fresh navigation entry", () => {
    const firstRender = render(<ScrollableMain>Profile</ScrollableMain>)
    const main = screen.getByRole("main")

    main.scrollTop = 480
    fireEvent.scroll(main)
    firstRender.unmount()

    navigation.bfcacheId = `fresh-${crypto.randomUUID()}`
    render(<ScrollableMain>Profile</ScrollableMain>)

    expect(screen.getByRole("main")).toHaveProperty("scrollTop", 0)
  })
})
