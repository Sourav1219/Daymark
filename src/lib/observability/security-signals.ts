import "server-only"

import * as Sentry from "@sentry/nextjs"

type SecurityAttribute = boolean | number | string

/**
 * Sends privacy-safe security telemetry to Sentry. High-volume signals are
 * metrics so alert thresholds can aggregate across every serverless instance;
 * urgent signals also create a grouped Sentry issue for immediate delivery.
 */
export function sendSecuritySignal(
  event: string,
  attributes: Record<string, SecurityAttribute>,
  options: Readonly<{ immediate?: boolean }> = {},
): void {
  Sentry.metrics.count("security.events", 1, {
    attributes: { event, ...attributes },
  })

  if (!options.immediate) return

  Sentry.withScope((scope) => {
    scope.setLevel("warning")
    scope.setTag("event_kind", "security")
    scope.setTag("security_event", event)
    scope.setTags(attributes)
    scope.setContext("security", attributes)
    scope.setFingerprint([
      "security",
      event,
      typeof attributes.job === "string" ? attributes.job : "all",
    ])
    Sentry.captureMessage(`Security alert: ${event}`)
  })
}
