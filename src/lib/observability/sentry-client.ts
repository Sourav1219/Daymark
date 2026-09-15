type SentryClient = typeof import("@sentry/nextjs")

let clientPromise: Promise<SentryClient> | null = null

/**
 * Load browser error monitoring only when it can no longer compete with the
 * initial render. Keeping this import behind a function also prevents the
 * Sentry browser SDK from becoming part of Next.js' critical client entry.
 */
export function loadSentryClient() {
  clientPromise ??= import("@sentry/nextjs")
    .then((sentry) => {
      sentry.init({
        enabled: true,
        dsn: "https://9b55a7d649ac055c7044ee38ee01d6cf@o4512047094038528.ingest.us.sentry.io/4512047111143424",
        dataCollection: {
          // Security monitoring does not require user data or request bodies.
          // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
          userInfo: false,
          httpBodies: [],
        },
      })

      return sentry
    })
    .catch((error: unknown) => {
      clientPromise = null
      throw error
    })

  return clientPromise
}
