import { redirect } from "next/navigation"

import { beforeEach, describe, expect, it, vi } from "vitest"

import HomePage from "./page"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses the static sign-in fallback when proxy did not redirect", () => {
    HomePage()

    expect(redirect).toHaveBeenCalledWith("/sign-in")
  })
})
