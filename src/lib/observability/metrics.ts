import { logSecurityEvent, logger } from "./logger"

/**
 * Process-local, dependency-free counters. Counts are per runtime instance and
 * rendered as a deterministic snapshot for log aggregation; they are not a
 * replacement for a metrics backend.
 */
const counters = new Map<string, number>()

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function counterKey(name: string, labels?: Record<string, string>): string {
  const sortedLabels = Object.entries(labels ?? {}).sort(([a], [b]) =>
    compareStrings(a, b),
  )
  return [name, ...sortedLabels.map(([key, value]) => `${key}=${value}`)].join(
    ",",
  )
}

export function incrementCounter(
  name: string,
  labels?: Record<string, string>,
): void {
  const key = counterKey(name, labels)
  counters.set(key, (counters.get(key) ?? 0) + 1)
}

export function renderMetricsSnapshot(): string {
  return [...counters.entries()]
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([key, count]) => `${key} ${count}`)
    .join("\n")
}

export type CronOutcome = "success" | "partial" | "denied"

export function observeCronOutcome(job: string, outcome: CronOutcome): void {
  incrementCounter("cron_outcome", { job, outcome })
  logger.info("cron.outcome", { job, outcome })
}

export type AuthorizationDenialReason =
  "unauthenticated" | "workspace_denied" | "workspace_id_invalid"

/** Counts and logs every server-side authorization denial for alerting. */
export function observeAuthorizationDenial(
  reason: AuthorizationDenialReason,
  details?: Record<string, unknown>,
): void {
  incrementCounter("authz_denied", { reason })
  logSecurityEvent("authorization.denied", { reason, ...details })
}

/** Counts rate-limited mutations per policy for abuse alerting. */
export function observeRateLimitHit(policy: string): void {
  incrementCounter("rate_limited", { policy })
  logSecurityEvent("rate_limit.hit", { policy })
}

/**
 * Records the due-but-unclaimed reminder count left after a processor run so
 * a growing backlog (claims are batch-bounded) can alert before due dates slip.
 */
export function observeReminderBacklog(remainingDue: number): void {
  incrementCounter("reminder_backlog")
  if (remainingDue > 0) {
    logger.warn("reminder.backlog", { remaining_due: remainingDue })
  }
}

/**
 * Records total promoted attachment bytes against the deployment threshold so
 * storage growth surfaces as an explicit warning instead of silent cost drift.
 */
export function observeStorageUsage(
  totalBytes: number,
  thresholdBytes: number,
): void {
  incrementCounter("storage_bytes_total")
  if (totalBytes >= thresholdBytes) {
    logger.warn("storage.quota_threshold_reached", {
      threshold_bytes: thresholdBytes,
      total_bytes: totalBytes,
    })
  }
}
