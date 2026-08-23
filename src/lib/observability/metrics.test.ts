import { afterEach, describe, expect, it, vi } from "vitest"

import {
  incrementCounter,
  observeAuthorizationDenial,
  observeCronOutcome,
  observeRateLimitHit,
  observeReminderBacklog,
  observeStorageUsage,
  renderMetricsSnapshot,
} from "@/lib/observability/metrics"

describe("observability metrics", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders counters as a deterministic sorted snapshot", () => {
    incrementCounter("cron_outcome", { job: "reminders", outcome: "success" })
    incrementCounter("cron_outcome", { job: "reminders", outcome: "success" })
    incrementCounter("cron_outcome", { outcome: "denied", job: "reminders" })

    expect(renderMetricsSnapshot()).toBe(
      [
        "cron_outcome,job=reminders,outcome=denied 1",
        "cron_outcome,job=reminders,outcome=success 2",
      ].join("\n"),
    )
  })

  it("counts authorization denials by reason and logs a security event", () => {
    const security = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined)

    observeAuthorizationDenial("workspace_denied", { user_id: "u1" })

    expect(renderMetricsSnapshot()).toContain(
      "authz_denied,reason=workspace_denied 1",
    )
    expect(security).toHaveBeenCalledWith(
      expect.stringContaining('"event":"authorization.denied"'),
    )
    expect(security).toHaveBeenCalledWith(
      expect.stringContaining('"reason":"workspace_denied"'),
    )
  })

  it("counts rate limit hits per policy", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)

    observeRateLimitHit("default")

    expect(renderMetricsSnapshot()).toContain("rate_limited,policy=default 1")
  })

  it("warns only when a reminder backlog exists", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    observeReminderBacklog(0)
    expect(warn).not.toHaveBeenCalled()

    observeReminderBacklog(120)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"remaining_due":120'),
    )
  })

  it("warns only when storage usage reaches the threshold", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    observeStorageUsage(1024, 4096)
    expect(warn).not.toHaveBeenCalled()

    observeStorageUsage(4096, 4096)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"total_bytes":4096'),
    )
  })

  it("records cron outcomes as counters and log lines", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined)

    observeCronOutcome("retention", "partial")

    expect(renderMetricsSnapshot()).toContain(
      "cron_outcome,job=retention,outcome=partial 1",
    )
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('"message":"cron.outcome"'),
    )
  })
})
