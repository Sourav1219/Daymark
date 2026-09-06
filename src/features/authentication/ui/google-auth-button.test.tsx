import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GoogleAuthButton } from "./google-auth-button"

const authClient = vi.hoisted(() => ({
  signIn: {
    social: vi.fn(),
  },
}))

vi.mock("@/features/authentication/client/auth-client", () => ({
  authClient,
}))

describe("GoogleAuthButton", () => {
  beforeEach(() => {
    authClient.signIn.social.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("explains why Google auth is unavailable before setup", () => {
    render(
      <GoogleAuthButton
        configured={false}
        mode="continue"
        nextPath="/today"
        oauthError={null}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeDisabled()
    expect(
      screen.getByText(/activate after OAuth credentials are added/iu),
    ).toBeVisible()
  })

  it("starts Google OAuth with safe success and error callbacks", async () => {
    authClient.signIn.social.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()

    render(
      <GoogleAuthButton
        configured
        mode="login"
        nextPath="/quests"
        oauthError={null}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    )

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      callbackURL: "/quests",
      errorCallbackURL: "/sign-in?authError=google&next=%2Fquests",
      newUserCallbackURL: "/quests",
      provider: "google",
      requestSignUp: false,
    })
    expect(
      screen.getByRole("button", { name: "Opening Google…" }),
    ).toBeDisabled()
  })

  it("shows a generic callback error without reflecting provider input", () => {
    render(
      <GoogleAuthButton
        configured
        mode="register"
        nextPath="/today"
        oauthError="generic"
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google sign-in was not completed. Please try again.",
    )
  })

  it("explicitly requests account creation from the registration form", async () => {
    authClient.signIn.social.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()

    render(
      <GoogleAuthButton
        configured
        mode="register"
        nextPath="/today"
        oauthError={null}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Sign up with Google" }),
    )

    expect(authClient.signIn.social).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCallbackURL: "/sign-up?authError=google&next=%2Ftoday",
        provider: "google",
        requestSignUp: true,
      }),
    )
  })

  it("directs unknown Google users to register first", () => {
    render(
      <GoogleAuthButton
        configured
        mode="login"
        nextPath="/today"
        oauthError="signup-required"
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No Traketo account exists for that Google email yet. Select Register, then use Sign up with Google first.",
    )
  })

  it("uses Chrome Custom Tabs and deep link callback when running in native Android container", async () => {
    const openMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("Capacitor", {
      isNativePlatform: () => true,
      Plugins: {
        App: {
          addListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
        },
        Browser: {
          close: vi.fn().mockResolvedValue(undefined),
          open: openMock,
        },
      },
    })

    authClient.signIn.social.mockResolvedValue({
      data: {
        url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=123",
      },
      error: null,
    })

    const user = userEvent.setup()

    render(
      <GoogleAuthButton
        configured
        mode="login"
        nextPath="/today"
        oauthError={null}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    )

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      callbackURL: "daymark://auth/callback?next=%2Ftoday",
      disableRedirect: true,
      errorCallbackURL:
        "daymark://auth/callback?authError=google&next=%2Ftoday",
      newUserCallbackURL: "daymark://auth/callback?next=%2Ftoday",
      provider: "google",
      requestSignUp: false,
    })

    expect(openMock).toHaveBeenCalledWith({
      url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=123",
      windowName: "_system",
    })
  })
})
