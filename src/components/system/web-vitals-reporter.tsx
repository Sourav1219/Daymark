"use client"

import { metrics } from "@sentry/nextjs"
import { useReportWebVitals } from "next/web-vitals"

const CORE_WEB_VITALS = new Set(["CLS", "FCP", "INP", "LCP", "TTFB"])
const PUBLIC_ROUTES = new Set([
  "/",
  "/about",
  "/app",
  "/cleared",
  "/contact",
  "/forgot-password",
  "/gates",
  "/privacy",
  "/privacy/controls",
  "/privacy/data",
  "/privacy/export",
  "/privacy/rights",
  "/privacy/security",
  "/privacy/transparency",
  "/reset-password",
  "/session-expired",
  "/sign-in",
  "/sign-out",
  "/sign-up",
  "/terms",
  "/~offline",
  "/verify-email",
])

const APP_ROUTES = new Set([
  "/profile",
  "/progress",
  "/quests",
  "/settings",
  "/settings/privacy-data",
  "/timer",
  "/today",
])

const ROUTE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/app\/workspaces\/[^/]+(?:\/.*)?$/, "/app/workspaces/[workspaceId]"],
  [/^\/quests\/[^/]+(?:\/.*)?$/, "/quests/[questId]"],
]

export function normalizeWebVitalsPathname(pathname: string) {
  const cleanPathname = pathname.split(/[?#]/, 1)[0] || "/"

  if (PUBLIC_ROUTES.has(cleanPathname) || APP_ROUTES.has(cleanPathname)) {
    return cleanPathname
  }

  return (
    ROUTE_PATTERNS.find(([pattern]) => pattern.test(cleanPathname))?.[1] ??
    "/other"
  )
}

export function getViewportBucket(width: number) {
  if (width < 768) return "mobile"
  if (width < 1280) return "tablet"
  return "desktop"
}

type WebVitalsMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0]

export function reportWebVital(metric: WebVitalsMetric) {
  if (!CORE_WEB_VITALS.has(metric.name)) return

  metrics.distribution(
    `web_vitals.${metric.name.toLowerCase()}`,
    metric.value,
    {
      unit: metric.name === "CLS" ? "ratio" : "millisecond",
      attributes: {
        navigation_type: metric.navigationType,
        rating: metric.rating,
        route: normalizeWebVitalsPathname(window.location.pathname),
        viewport: getViewportBucket(window.innerWidth),
      },
    },
  )
}

export function WebVitalsReporter() {
  useReportWebVitals(reportWebVital)
  return null
}
