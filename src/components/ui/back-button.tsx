"use client"

import { useCallback } from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"

type BackButtonProps = Readonly<{
  /** Accessible label for screen readers. */
  "aria-label"?: string
  /** CSS class applied to the rendered element. */
  className?: string
  /** Content (icon / text) rendered inside the button or link. */
  children: React.ReactNode
  /**
   * Fallback href used when there is no browser history entry to go back to
   * (e.g. user opened the page in a new tab directly).
   */
  fallbackHref: Route
}>

/**
 * A back-navigation control that uses `router.back()` when browser history
 * exists so the previous page is restored from Next.js's client-side cache
 * (no server round-trip). Falls back to a plain `<Link>` when there is no
 * history to pop — e.g. the user landed on the page directly.
 */
export function BackButton({
  "aria-label": ariaLabel = "Go back",
  className,
  children,
  fallbackHref,
}: BackButtonProps) {
  const router = useRouter()

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      // If there's at least one history entry before this page we can pop it.
      // window.history.length is 1 when the page was opened cold (new tab,
      // direct URL), and 2+ when the user navigated from somewhere.
      if (typeof window !== "undefined" && window.history.length > 1) {
        event.preventDefault()
        router.back()
      }
      // Otherwise let the default <Link> navigation take over.
    },
    [router],
  )

  return (
    <Link
      aria-label={ariaLabel}
      className={className}
      href={fallbackHref}
      onClick={handleClick}
    >
      {children}
    </Link>
  )
}
