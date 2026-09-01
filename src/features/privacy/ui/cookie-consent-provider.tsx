"use client"

import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import Link from "next/link"
import { Cookie, X } from "lucide-react"

import { saveCookieConsentAction } from "@/features/privacy/application/cookie-consent-actions"
import {
  clearOptionalBrowserStorage,
  cookieConsentChangedEvent,
} from "@/features/privacy/client/optional-browser-storage"
import type { CookieConsent } from "@/features/privacy/domain/cookie-consent"

type CookieConsentContextValue = Readonly<{
  consent: CookieConsent | null
  openPreferences: () => void
  preferenceStorageAllowed: boolean
}>

const CookieConsentContext = createContext<CookieConsentContextValue | null>(
  null,
)

export function useCookieConsent(): CookieConsentContextValue {
  const value = useContext(CookieConsentContext)
  if (!value) {
    throw new Error(
      "useCookieConsent must be used inside CookieConsentProvider",
    )
  }
  return value
}

export function CookieConsentProvider({
  children,
  initialConsent,
}: Readonly<{
  children: ReactNode
  initialConsent: CookieConsent | null
}>) {
  const [consent, setConsent] = useState(initialConsent)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const openPreferences = useCallback(() => setOpen(true), [])

  function choose(nextConsent: CookieConsent) {
    setError(null)
    startTransition(async () => {
      try {
        const savedConsent = await saveCookieConsentAction(nextConsent)
        if (!savedConsent) {
          setError("Your preference could not be saved. Please try again.")
          return
        }
        if (savedConsent === "essential") clearOptionalBrowserStorage()
        setConsent(savedConsent)
        setOpen(false)
        window.dispatchEvent(new Event(cookieConsentChangedEvent))
      } catch {
        setError("Your preference could not be saved. Please try again.")
      }
    })
  }

  const contextValue = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      openPreferences,
      preferenceStorageAllowed: consent === "preferences",
    }),
    [consent, openPreferences],
  )

  return (
    <CookieConsentContext.Provider value={contextValue}>
      {children}

      {open ? (
        <aside
          aria-describedby="cookie-consent-description"
          aria-labelledby="cookie-consent-title"
          className="cookie-consent"
          role="dialog"
        >
          <div className="cookie-consent__heading">
            <span className="cookie-consent__icon" aria-hidden="true">
              <Cookie />
            </span>
            <div>
              <span className="cookie-consent__eyebrow">Your privacy</span>
              <h2 id="cookie-consent-title">Cookies &amp; privacy</h2>
              <p id="cookie-consent-description">
                Traketo uses essential cookies for secure sign-in. With your
                permission, optional storage remembers your preferences.
                Essential cookies remain active if you decline.{" "}
                <Link href="/privacy">Learn more</Link>
              </p>
            </div>
            <button
              aria-label="Close cookie settings"
              className="cookie-consent__close"
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          {error ? (
            <p className="cookie-consent__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="cookie-consent__actions">
            <button
              disabled={pending}
              onClick={() => choose("preferences")}
              type="button"
            >
              Allow Cookies
            </button>
            <button
              aria-label="Decline optional cookies"
              disabled={pending}
              onClick={() => choose("essential")}
              type="button"
            >
              Decline
            </button>
          </div>
        </aside>
      ) : null}
    </CookieConsentContext.Provider>
  )
}

export function CookieSettingsButton() {
  const { consent, openPreferences } = useCookieConsent()

  return (
    <button
      className="cookie-settings-inline"
      onClick={openPreferences}
      type="button"
    >
      <Cookie aria-hidden="true" />
      Cookie settings
      {consent
        ? ` · ${consent === "preferences" ? "Preferences allowed" : "Essential only"}`
        : ""}
    </button>
  )
}
