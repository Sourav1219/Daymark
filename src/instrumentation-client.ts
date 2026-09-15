// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import type { RouterTransitionType } from "next"

import { loadSentryClient } from "./lib/observability/sentry-client"

const MONITORING_DELAY_MS = 8_000

if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  const initializeWhenIdle = () => {
    window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => void loadSentryClient(), {
          timeout: 2_000,
        })
      } else {
        void loadSentryClient()
      }
    }, MONITORING_DELAY_MS)
  }

  if (document.readyState === "complete") {
    initializeWhenIdle()
  } else {
    window.addEventListener("load", initializeWhenIdle, { once: true })
  }
}

export function onRouterTransitionStart(
  url: string,
  navigationType: RouterTransitionType,
) {
  if (process.env.NODE_ENV !== "production") return

  void loadSentryClient().then(({ captureRouterTransitionStart }) => {
    captureRouterTransitionStart(url, navigationType)
  })
}
