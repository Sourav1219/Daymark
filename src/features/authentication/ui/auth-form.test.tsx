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
  GoogleAuthButton: ({
    mode,
    registrationAllowed,
    onRegistrationAgreementRequired,
  }: {
    mode: "continue" | "login" | "register"
    registrationAllowed?: boolean
    onRegistrationAgreementRequired?: () => void
  }) => (
    <button
      onClick={() => {
        if (mode === "register" && !registrationAllowed) {
          onRegistrationAgreementRequired?.()
        }
      }}
      type="button"
    >
      {mode === "register" ? "Sign up with Google" : "Sign in with Google"}
    </button>
  ),
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

  it("shows sign-in help and separate required registration agreements", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AuthForm
        googleAuthConfigured={false}
        mode="login"
        nextPath="/today"
        notice={null}
        oauthError={null}
      />,
    )

    const contactLink = screen.getByRole("link", { name: /Contact us/i })
    expect(contactLink).toBeInTheDocument()
    expect(contactLink).toHaveAttribute("href", "/contact")
    expect(screen.queryByText(/Report a problem/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Having trouble signing in\?/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/By creating an account, you agree to Traketo/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()

    rerender(
      <AuthForm
        googleAuthConfigured={false}
        mode="register"
        nextPath="/today"
        notice={null}
        oauthError={null}
      />,
    )

    expect(
      screen.queryByRole("link", { name: /Contact us/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Having trouble signing in\?/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Your data, in plain language/i),
    ).not.toBeInTheDocument()
    const terms = screen.getByRole("checkbox", {
      name: /I confirm I am 18 or older and accept the Terms of Service/i,
    })
    const privacy = screen.getByRole("checkbox", {
      name: /I have read the Privacy Notice/i,
    })
    const create = screen.getByRole("button", { name: "Create" })
    const form = create.closest("form")

    expect(screen.getAllByRole("checkbox")).toHaveLength(2)
    expect(terms).toBeRequired()
    expect(privacy).toBeRequired()
    expect(form).toContainElement(terms)
    expect(form).toContainElement(privacy)
    expect(create).toBeDisabled()
    await user.click(
      screen.getByRole("button", { name: "Sign up with Google" }),
    )
    expect(terms).toHaveFocus()
    expect(
      screen.getByText("Please review and accept the terms to continue."),
    ).toBeVisible()
    expect(terms.closest(".auth__agreements")).toHaveClass(
      "auth__agreements--error",
    )
    await user.click(terms)
    expect(create).toBeDisabled()
    await user.click(privacy)
    expect(create).toBeEnabled()
    expect(
      screen.queryByText("Please review and accept the terms to continue."),
    ).not.toBeInTheDocument()
  })
})
