import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GoogleAuthButton } from "./google-auth-button"

const authClient = vi.hoisted(() => ({
  signIn: {
    social: vi.fn(),
  },
}))
const prepareGoogleRegistrationAction = vi.hoisted(() => vi.fn())

vi.mock("@/features/authentication/client/auth-client", () => ({
  authClient,
}))
vi.mock("@/features/authentication/application/actions", () => ({
  prepareGoogleRegistrationAction,
}))

describe("GoogleAuthButton", () => {
  beforeEach(() => {
    authClient.signIn.social.mockReset()
    prepareGoogleRegistrationAction.mockReset()
    prepareGoogleRegistrationAction.mockResolvedValue({
      data: { ready: true },
      ok: true,
    })
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

  it("stays clickable but blocks registration OAuth until agreements are accepted", async () => {
    const onRegistrationAgreementRequired = vi.fn()
    const user = userEvent.setup()

    render(
      <GoogleAuthButton
        configured
        mode="register"
        nextPath="/today"
        oauthError={null}
        onRegistrationAgreementRequired={onRegistrationAgreementRequired}
      />,
    )

    const button = screen.getByRole("button", {
      name: "Sign up with Google",
    })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(onRegistrationAgreementRequired).toHaveBeenCalledOnce()
    expect(prepareGoogleRegistrationAction).not.toHaveBeenCalled()
    expect(authClient.signIn.social).not.toHaveBeenCalled()
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
        registrationAllowed
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
    expect(prepareGoogleRegistrationAction).toHaveBeenCalledWith({
      privacyNoticeAcknowledged: true,
      termsAccepted: true,
    })
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

  it("sanitizes deep-link redirect target and blocks open redirects", async () => {
    let deepLinkCallback: ((data: { url: string }) => void) | undefined
    const assignSpy = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign: assignSpy },
      writable: true,
    })

    vi.stubGlobal("Capacitor", {
      isNativePlatform: () => true,
      Plugins: {
        App: {
          addListener: vi.fn().mockImplementation((_event, cb) => {
            deepLinkCallback = cb
            return { remove: vi.fn() }
          }),
        },
        Browser: {
          close: vi.fn().mockResolvedValue(undefined),
          open: vi.fn().mockResolvedValue(undefined),
        },
      },
    })

    render(
      <GoogleAuthButton
        configured
        mode="login"
        nextPath="/today"
        oauthError={null}
      />,
    )

    try {
      expect(deepLinkCallback).toBeDefined()
      deepLinkCallback?.({
        url: "daymark://auth/callback?next=https://malicious.example.com",
      })

      // Allow the async handler to complete
      await vi.waitFor(() => {
        expect(assignSpy).toHaveBeenCalledWith("/today")
      })
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
        writable: true,
      })
    }
  })
})
