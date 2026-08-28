"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles, X } from "lucide-react"

import { todayPromoStorageKey } from "@/features/privacy/client/optional-browser-storage"
import { useCookieConsent } from "@/features/privacy/ui/cookie-consent-provider"

/**
 * Dismissible promo banner. Content is static for now; dismissal persists in
 * localStorage so it stays hidden across reloads.
 */
export function TodayPromo() {
  const { preferenceStorageAllowed } = useCookieConsent()
  // "pending" until mounted so the server + first client render match, then
  // resolve to shown/hidden from localStorage.
  const [state, setState] = useState<"hidden" | "pending" | "shown">("pending")

  useEffect(() => {
    let nextState: "hidden" | "shown" = "shown"
    if (preferenceStorageAllowed) {
      try {
        nextState =
          window.localStorage.getItem(todayPromoStorageKey) === "1"
            ? "hidden"
            : "shown"
      } catch {
        // The promo stays usable when storage is blocked or unavailable.
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only read of persisted dismissal
    setState(nextState)
  }, [preferenceStorageAllowed])

  if (state !== "shown") {
    return null
  }

  return (
    <section className="today-banner">
      <span aria-hidden="true" className="today-banner__glow" />
      <div className="today-banner__body">
        <p className="today-banner__title">Keep your streak alive</p>
        <p className="today-banner__text">
          Complete one task today to keep your streak growing.
        </p>
        <Link className="today-banner__cta" href="/progress">
          <Sparkles aria-hidden="true" />
          View progress
        </Link>
      </div>
      <button
        aria-label="Dismiss"
        className="today-banner__close"
        onClick={() => {
          if (preferenceStorageAllowed) {
            window.localStorage.setItem(todayPromoStorageKey, "1")
          }
          setState("hidden")
        }}
        type="button"
      >
        <X aria-hidden="true" />
      </button>
    </section>
  )
}
