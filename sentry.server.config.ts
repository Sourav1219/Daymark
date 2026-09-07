// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: "https://9b55a7d649ac055c7044ee38ee01d6cf@o4512047094038528.ingest.us.sentry.io/4512047111143424",

  dataCollection: {
    // Security monitoring does not require user data or request bodies.
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    userInfo: false,
    httpBodies: [],
  },
})
