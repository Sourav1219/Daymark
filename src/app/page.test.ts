import { redirect } from "next/navigation"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { getCurrentUser } from "@/features/authentication/server/authorization"

import HomePage from "./page"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

vi.mock("@/features/authentication/server/authorization", () => ({
  getCurrentUser: vi.fn(),
}))

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects unauthenticated users to sign-in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    await HomePage()

    expect(redirect).toHaveBeenCalledWith("/sign-in")
  })

  it("redirects authenticated users directly to today", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      createdAt: new Date(),
      email: "user@traketo.test",
      emailVerified: true,
      id: "user-123",
      image: null,
      name: "Test User",
      updatedAt: new Date(),
    })

    await HomePage()

    expect(redirect).toHaveBeenCalledWith("/today")
  })
})
