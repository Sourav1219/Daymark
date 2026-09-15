"use client"

import { useReportWebVitals } from "next/web-vitals"

import { loadSentryClient } from "@/lib/observability/sentry-client"

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

const REPORT_DELAY_MS = 8_000
const pendingMetrics: WebVitalsMetric[] = []
let reportTimer: number | null = null

async function flushWebVitals() {
  reportTimer = null
  const metricsToReport = pendingMetrics.splice(0)
  if (metricsToReport.length === 0) return

  try {
    const { metrics } = await loadSentryClient()

    for (const metric of metricsToReport) {
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
  } catch {
    // Observability must never interfere with the application experience.
  }
}

function scheduleWebVitalsFlush() {
  if (reportTimer !== null) return

  reportTimer = window.setTimeout(() => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => void flushWebVitals(), {
        timeout: 2_000,
      })
      return
    }

    void flushWebVitals()
  }, REPORT_DELAY_MS)
}

export function reportWebVital(metric: WebVitalsMetric) {
  if (!CORE_WEB_VITALS.has(metric.name)) return

  pendingMetrics.push(metric)
  scheduleWebVitalsFlush()
}

export function WebVitalsReporter() {
  useReportWebVitals(reportWebVital)
  return null
}
