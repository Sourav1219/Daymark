import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AuthExperience } from "./auth-experience"

vi.mock("@/features/authentication/ui/auth-form", () => ({
  AuthForm: () => null,
}))

describe("AuthExperience support footer", () => {
  it("keeps contact support without showing problem reporting on sign in", () => {
    render(
      <AuthExperience
        googleAuthConfigured={false}
        initial="welcome"
        nextPath="/today"
        notice={null}
        oauthError={null}
      />,
    )

    expect(screen.queryByText(/Report a problem/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Contact support/i }),
    ).toHaveAttribute("href", "/contact")
  })
})
