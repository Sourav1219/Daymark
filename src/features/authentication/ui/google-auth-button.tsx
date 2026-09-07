"use client"

import { useEffect, useState } from "react"

import { authClient } from "@/features/authentication/client/auth-client"
import { safeRedirectPath } from "@/features/authentication/application/validation"
import {
  closeAuthSession,
  isCapacitorNative,
  openAuthSession,
  setupAuthDeepLinkListener,
} from "@/lib/platform/platform-bridge"

export type GoogleOAuthError = "generic" | "signup-required" | null

type GoogleAuthButtonProps = Readonly<{
  configured: boolean
  mode: "continue" | "login" | "register"
  nextPath: string
  oauthError: GoogleOAuthError
}>

const labels = {
  continue: "Continue with Google",
  login: "Sign in with Google",
  register: "Sign up with Google",
} as const

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.71-.06-1.23-.2-1.77H12v3.4h5.52a4.7 4.7 0 0 1-2.05 3.08l-.02.11 2.98 2.3.2.02c1.84-1.7 2.97-4.2 2.97-7.14Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.68 0 4.93-.88 6.57-2.4l-3.13-2.43c-.84.57-1.97.97-3.44.97a5.98 5.98 0 0 1-5.66-4.13l-.1.01-3.1 2.4-.04.1A9.92 9.92 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.34 14.01A6.1 6.1 0 0 1 6 12c0-.7.12-1.38.32-2.01v-.12L3.2 7.43l-.1.05A10 10 0 0 0 2 12c0 1.63.4 3.18 1.1 4.52l3.24-2.51Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.86c1.87 0 3.13.8 3.85 1.48l2.79-2.72A9.42 9.42 0 0 0 12 2a9.92 9.92 0 0 0-8.9 5.48l3.22 2.51A6 6 0 0 1 12 5.86Z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function GoogleAuthButton({
  configured,
  mode,
  nextPath,
  oauthError,
}: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCapacitorNative()) return

    const cleanup = setupAuthDeepLinkListener(async (deepLinkUrl) => {
      await closeAuthSession()
      setPending(false)
      try {
        const parsed = new URL(deepLinkUrl)
        const rawNext = parsed.searchParams.get("next")
        const target = safeRedirectPath(rawNext || nextPath || "/today")
        if (typeof window !== "undefined") {
          window.location.assign(target)
        }
      } catch {
        if (typeof window !== "undefined") {
          window.location.assign(safeRedirectPath(nextPath || "/today"))
        }
      }
    })

    return cleanup
  }, [nextPath])

  async function startGoogleAuth() {
    if (!configured || pending) return

    setPending(true)
    setClientError(null)

    try {
      const isNative = isCapacitorNative()
      const errorPath = mode === "register" ? "/sign-up" : "/sign-in"

      if (isNative) {
        // Native Android container: use custom scheme callback and open in Chrome Custom Tabs
        const nativeCallbackUrl = `daymark://auth/callback?next=${encodeURIComponent(nextPath)}`
        const nativeErrorUrl = `daymark://auth/callback?authError=google&next=${encodeURIComponent(nextPath)}`

        const result = await authClient.signIn.social({
          callbackURL: nativeCallbackUrl,
          disableRedirect: true,
          errorCallbackURL: nativeErrorUrl,
          newUserCallbackURL: nativeCallbackUrl,
          provider: "google",
          requestSignUp: mode === "register",
        })

        if (result.error) {
          setClientError("Google sign-in could not start. Please try again.")
          setPending(false)
          return
        }

        const authUrl = (result.data as { url?: string })?.url
        if (authUrl) {
          await openAuthSession(authUrl)
        } else {
          setClientError("Google sign-in could not start. Please try again.")
          setPending(false)
        }
      } else {
        // Standard Web browser: identical to existing flow
        const result = await authClient.signIn.social({
          callbackURL: nextPath,
          errorCallbackURL: `${errorPath}?authError=google&next=${encodeURIComponent(nextPath)}`,
          newUserCallbackURL: nextPath,
          provider: "google",
          requestSignUp: mode === "register",
        })

        if (result.error) {
          setClientError("Google sign-in could not start. Please try again.")
          setPending(false)
        }
      }
    } catch {
      setClientError("Google sign-in could not start. Please try again.")
      setPending(false)
    }
  }

  const error =
    clientError ??
    (oauthError === "signup-required"
      ? "No Traketo account exists for that Google email yet. Select Register, then use Sign up with Google first."
      : oauthError === "generic"
        ? "Google sign-in was not completed. Please try again."
        : null)

  return (
    <div className="auth__google-group">
      <button
        className="auth__google-button"
        disabled={!configured || pending}
        onClick={startGoogleAuth}
        type="button"
      >
        <GoogleMark />
        <span>{pending ? "Opening Google…" : labels[mode]}</span>
      </button>
      {!configured ? (
        <p className="auth__google-note" role="status">
          Google sign-in will activate after OAuth credentials are added.
        </p>
      ) : null}
      {error ? (
        <p className="auth__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
