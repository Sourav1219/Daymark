import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getViewportBucket,
  normalizeWebVitalsPathname,
  WebVitalsReporter,
} from "./web-vitals-reporter"

const mocks = vi.hoisted(() => ({
  distribution: vi.fn(),
  report: undefined as ((metric: Record<string, unknown>) => void) | undefined,
}))

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  metrics: { distribution: mocks.distribution },
}))

vi.mock("next/web-vitals", () => ({
  useReportWebVitals: (report: (metric: Record<string, unknown>) => void) => {
    mocks.report = report
  },
}))

describe("WebVitalsReporter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.distribution.mockReset()
    mocks.report = undefined
    window.history.replaceState({}, "", "/sign-in")
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    })
  })

  it("reports a normalized Core Web Vital without visitor identifiers", async () => {
    render(<WebVitalsReporter />)

    mocks.report?.({
      delta: 2_400,
      entries: [],
      id: "v4-private-id",
      name: "LCP",
      navigationType: "navigate",
      rating: "good",
      value: 2_400,
    })

    await vi.advanceTimersByTimeAsync(8_000)

    expect(mocks.distribution).toHaveBeenCalledWith("web_vitals.lcp", 2_400, {
      unit: "millisecond",
      attributes: {
        navigation_type: "navigate",
        rating: "good",
        route: "/sign-in",
        viewport: "mobile",
      },
    })
  })

  it("ignores metrics outside the performance dashboard", () => {
    render(<WebVitalsReporter />)

    mocks.report?.({ name: "custom", value: 10 })

    expect(mocks.distribution).not.toHaveBeenCalled()
  })
})

describe("web-vitals dimensions", () => {
  it("prevents dynamic route values from creating high-cardinality telemetry", () => {
    expect(
      normalizeWebVitalsPathname("/quests/private-task-id?tab=notes"),
    ).toBe("/quests/[questId]")
    expect(normalizeWebVitalsPathname("/unknown/user-generated-value")).toBe(
      "/other",
    )
  })

  it("groups viewport widths into stable buckets", () => {
    expect(getViewportBucket(390)).toBe("mobile")
    expect(getViewportBucket(900)).toBe("tablet")
    expect(getViewportBucket(1_440)).toBe("desktop")
  })
})
