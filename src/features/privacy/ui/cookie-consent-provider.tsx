"use client"

import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Cookie, ChevronRight, X } from "lucide-react"

import { saveCookieConsentAction } from "@/features/privacy/application/cookie-consent-actions"
import {
  clearOptionalBrowserStorage,
  cookieConsentChangedEvent,
  readCookieConsent,
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

function subscribeToCookieConsent(onChange: () => void) {
  window.addEventListener(cookieConsentChangedEvent, onChange)
  return () => window.removeEventListener(cookieConsentChangedEvent, onChange)
}

function noServerCookieConsent() {
  return null
}

function subscribeStatic() {
  return () => undefined
}

function getClientMounted() {
  return true
}

function getServerMounted() {
  return false
}

const defaultCookieConsentContextValue: CookieConsentContextValue = {
  consent: null,
  openPreferences: () => {},
  preferenceStorageAllowed: false,
}

export function useCookieConsent(): CookieConsentContextValue {
  const value = useContext(CookieConsentContext)
  return value ?? defaultCookieConsentContextValue
}

export function CookieConsentProvider({
  children,
  initialConsent = null,
}: Readonly<{
  children: ReactNode
  initialConsent?: CookieConsent | null
}>) {
  const browserConsent = useSyncExternalStore(
    subscribeToCookieConsent,
    readCookieConsent,
    noServerCookieConsent,
  )
  const consent = initialConsent ?? browserConsent

  // explicitOpen: null = default (only open for new visitors, i.e., consent === null),
  // true = explicitly opened (e.g. settings button), false = explicitly closed/dismissed.
  const [explicitOpen, setExplicitOpen] = useState<boolean | null>(null)
  const [showChoices, setShowChoices] = useState(false)
  const [explicitPreferencesAllowed, setExplicitPreferencesAllowed] = useState<
    boolean | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const customPreferencesAllowed =
    explicitPreferencesAllowed ?? consent === "preferences"

  const openPreferences = useCallback(() => {
    setError(null)
    setExplicitOpen(true)
    setShowChoices(true)
    setExplicitPreferencesAllowed(null)
  }, [])

  // Automatically show only to new visitors (consent === null) unless explicitly closed.
  const isOpen = explicitOpen ?? consent === null

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
        setExplicitOpen(false)
        setShowChoices(false)
        setExplicitPreferencesAllowed(null)
        window.dispatchEvent(new Event(cookieConsentChangedEvent))
      } catch {
        setError("Your preference could not be saved. Please try again.")
      }
    })
  }

  function handleSaveChoices() {
    choose(customPreferencesAllowed ? "preferences" : "essential")
  }

  const contextValue = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      openPreferences,
      preferenceStorageAllowed: consent === "preferences",
    }),
    [consent, openPreferences],
  )

  const mounted = useSyncExternalStore(
    subscribeStatic,
    getClientMounted,
    getServerMounted,
  )

  const dialogContent = isOpen ? (
    <div
      aria-hidden={false}
      className="cookie-consent-overlay"
      onClick={() => {
        setExplicitOpen(false)
        setShowChoices(false)
      }}
    >
      <aside
        aria-describedby="cookie-consent-description"
        aria-labelledby="cookie-consent-title"
        aria-modal="true"
        className="cookie-consent"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="cookie-consent__heading">
          <span className="cookie-consent__icon" aria-hidden="true">
            <Cookie />
          </span>
          <div>
            <span className="cookie-consent__eyebrow">Your privacy</span>
            <h2 id="cookie-consent-title">
              {showChoices ? "Manage cookie choices" : "Cookies & privacy"}
            </h2>
            <p id="cookie-consent-description">
              {showChoices ? (
                <>
                  Choose whether to allow optional preference storage. Essential
                  cookies remain active. <Link href="/privacy">Learn more</Link>
                </>
              ) : (
                <>
                  Essential cookies enable secure sign-in. With your permission,
                  optional storage remembers preferences.{" "}
                  <Link href="/privacy">Learn more</Link>
                </>
              )}
            </p>
          </div>
          <button
            aria-label="Close cookie settings"
            className="cookie-consent__close"
            disabled={pending}
            onClick={() => {
              setExplicitOpen(false)
              setShowChoices(false)
            }}
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

        {consent !== null && showChoices ? (
          <p className="cookie-consent__status-note">
            Current selection:{" "}
            <strong>
              {consent === "preferences"
                ? "Optional preferences allowed"
                : "Essential cookies only"}
            </strong>
            {consent === "preferences"
              ? " · You can withdraw consent below at any time."
              : ""}
          </p>
        ) : null}

        {showChoices ? (
          <>
            <div
              aria-label="Cookie choices"
              className="cookie-consent__choices"
              role="region"
            >
              <div className="cookie-consent__choice-card">
                <div className="cookie-consent__choice-header">
                  <span className="cookie-consent__choice-title">
                    Essential cookies &amp; storage
                  </span>
                  <span className="cookie-consent__badge">Always active</span>
                </div>
                <p className="cookie-consent__choice-desc">
                  Required for secure sign-in, session integrity, and core
                  security. Cannot be turned off.
                </p>
              </div>

              <div className="cookie-consent__choice-card">
                <div className="cookie-consent__choice-header">
                  <span className="cookie-consent__choice-title">
                    Optional preferences
                  </span>
                  <label
                    aria-label="Toggle optional preferences"
                    className="cookie-consent__toggle"
                  >
                    <input
                      checked={customPreferencesAllowed}
                      disabled={pending}
                      onChange={(e) =>
                        setExplicitPreferencesAllowed(e.target.checked)
                      }
                      type="checkbox"
                    />
                    <span
                      aria-hidden="true"
                      className="cookie-consent__toggle-slider"
                    />
                  </label>
                </div>
                <p className="cookie-consent__choice-desc">
                  Remembers non-essential UI preferences, deadline notification
                  alerts, and dismissed notices across visits.
                </p>
              </div>
            </div>

            <div className="cookie-consent__actions">
              <button
                className="cookie-consent__btn cookie-consent__btn--equal"
                disabled={pending}
                onClick={handleSaveChoices}
                type="button"
              >
                Save choices
              </button>
              <button
                aria-label="Essential cookies only (withdraw consent)"
                className="cookie-consent__btn cookie-consent__btn--equal"
                disabled={pending}
                onClick={() => choose("essential")}
                type="button"
              >
                Essential only
              </button>
            </div>
          </>
        ) : (
          <div className="cookie-consent__actions">
            <button
              className="cookie-consent__btn cookie-consent__btn--equal"
              disabled={pending}
              onClick={() => choose("preferences")}
              type="button"
            >
              Accept all
            </button>
            <button
              className="cookie-consent__btn cookie-consent__btn--equal"
              disabled={pending}
              onClick={() => choose("essential")}
              type="button"
            >
              Essential only
            </button>
          </div>
        )}
      </aside>
    </div>
  ) : null

  const portalTarget =
    typeof document !== "undefined"
      ? (document.getElementById("app-device-viewport") ?? document.body)
      : null

  return (
    <CookieConsentContext.Provider value={contextValue}>
      {children}
      {mounted && portalTarget && dialogContent
        ? createPortal(dialogContent, portalTarget)
        : null}
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

export function ProfileCookieSettingsButton() {
  const { consent, openPreferences } = useCookieConsent()

  return (
    <button
      className="profile-help-settings__action"
      onClick={openPreferences}
      type="button"
    >
      <span>
        <Cookie aria-hidden="true" />
      </span>
      <div>
        <strong>Cookie preferences</strong>
        <small>
          {consent === "preferences"
            ? "Optional preferences allowed"
            : consent === "essential"
              ? "Essential cookies only"
              : "Manage storage choices"}
        </small>
      </div>
      <ChevronRight aria-hidden="true" />
    </button>
  )
}
