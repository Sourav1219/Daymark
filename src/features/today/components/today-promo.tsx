"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Sparkles, X } from "lucide-react"

import { claimTodayPromoAction } from "@/features/today/application/today-promo-actions"

/**
 * Dismissible promo banner. Its once-daily display is atomically claimed from
 * the server after mount; local state only handles the current view.
 */
export function TodayPromo() {
  const [shown, setShown] = useState(false)
  const [, startTransition] = useTransition()
  const claimRef = useRef<Promise<boolean> | null>(null)

  useEffect(() => {
    let active = true
    const claim = claimRef.current ?? claimTodayPromoAction()
    claimRef.current = claim
    startTransition(async () => {
      try {
        const claimed = await claim
        if (active) setShown(claimed)
      } catch {
        // A failed claim stays hidden and can safely retry on the next visit.
      }
    })

    return () => {
      active = false
    }
  }, [])

  if (!shown) {
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
        onClick={() => setShown(false)}
        type="button"
      >
        <X aria-hidden="true" />
      </button>
    </section>
  )
}
