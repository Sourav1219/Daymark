/**
 * Structured logger for Traketo observability.
 *
 * Provides JSON-formatted logs suitable for aggregation (e.g., Datadog, ELK).
 * Includes correlation IDs and standardized error reporting.
 */
export function logSecurityEvent(
  event: string,
  details?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      level: "info",
      event_kind: "security",
      event,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  )
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        timestamp: new Date().toISOString(),
        ...context,
      }),
    )
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        timestamp: new Date().toISOString(),
        ...context,
      }),
    )
  },
  error: (
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ) => {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        timestamp: new Date().toISOString(),
        error: error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : undefined,
        ...context,
      }),
    )
  },
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        JSON.stringify({
          level: "debug",
          message,
          timestamp: new Date().toISOString(),
          ...context,
        }),
      )
    }
  },
}
