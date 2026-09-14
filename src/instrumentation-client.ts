// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { captureRouterTransitionStart, init } from "@sentry/nextjs"

if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  const initSentry = () => {
    init({
      enabled: true,
      dsn: "https://9b55a7d649ac055c7044ee38ee01d6cf@o4512047094038528.ingest.us.sentry.io/4512047111143424",
      dataCollection: {
        // Security monitoring does not require user data or request bodies.
        // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
        userInfo: false,
        httpBodies: [],
      },
    })
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(initSentry, { timeout: 2500 })
  } else {
    setTimeout(initSentry, 1000)
  }
}

export const onRouterTransitionStart = captureRouterTransitionStart
