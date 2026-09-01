import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AuthForm } from "./auth-form"

const actions = vi.hoisted(() => ({
  loginAction: vi.fn(),
  registerAction: vi.fn(),
  resendVerificationAction: vi.fn(),
  verifyEmailCodeAction: vi.fn(),
}))

vi.mock("@/features/authentication/application/actions", () => actions)
vi.mock("@/features/authentication/ui/google-auth-button", () => ({
  GoogleAuthButton: () => null,
}))
vi.mock("@/features/reminders/components/automatic-push-enrollment", () => ({
  requestAutomaticPushPermission: vi.fn(),
}))

describe("AuthForm password visibility", () => {
  it("can render a direct sign-in without an entrance animation", () => {
    const { container } = render(
      <AuthForm
        googleAuthConfigured={false}
        mode="login"
        nextPath="/today"
        notice={null}
        oauthError={null}
        skipEntranceAnimation
      />,
    )

    expect(container.querySelector(".auth__inner")).toHaveClass(
      "auth__inner--instant",
    )
  })

  it.each(["login", "register"] as const)(
    "toggles the password without clearing it in %s mode",
    async (mode) => {
      const user = userEvent.setup()

      render(
        <AuthForm
          googleAuthConfigured={false}
          mode={mode}
          nextPath="/today"
          notice={null}
          oauthError={null}
        />,
      )

      const password = screen.getByLabelText("Password")
      expect(password).toHaveAttribute("type", "password")

      await user.type(password, "correct-horse-battery-staple")
      await user.click(screen.getByRole("button", { name: "Show password" }))

      expect(password).toHaveAttribute("type", "text")
      expect(password).toHaveValue("correct-horse-battery-staple")
      expect(
        screen.getByRole("button", { name: "Hide password" }),
      ).toHaveAttribute("aria-pressed", "true")

      await user.click(screen.getByRole("button", { name: "Hide password" }))

      expect(password).toHaveAttribute("type", "password")
      expect(password).toHaveValue("correct-horse-battery-staple")
    },
  )
})
