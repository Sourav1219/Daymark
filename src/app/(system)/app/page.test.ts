import { redirect } from "next/navigation"

import { describe, expect, it, vi } from "vitest"

import PersonalWorkspacePage from "./page"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

describe("PersonalWorkspacePage", () => {
  it("redirects legacy app visits to Today", () => {
    PersonalWorkspacePage()

    expect(redirect).toHaveBeenCalledWith("/today")
  })
})
