import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearSessionMode,
  getPreferredMode,
  getPresetById,
  getSessionMode,
  playTimerChime,
  setPreferredMode,
  setSessionMode,
  timerPresets,
} from "@/features/timer/domain/timer-modes"

describe("timer-modes", () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("exposes standard Pomodoro, Deep Work, Break, and Stopwatch presets", () => {
    const ids = timerPresets.map((preset) => preset.id)
    expect(ids).toEqual(["pomodoro", "deep-work", "short-break", "stopwatch"])
    expect(getPresetById("pomodoro").durationMinutes).toBe(25)
    expect(getPresetById("deep-work").durationMinutes).toBe(50)
    expect(getPresetById("short-break").durationMinutes).toBe(5)
    expect(getPresetById("stopwatch").durationMinutes).toBe(0)
  })

  it("falls back to default preset for unknown mode", () => {
    // @ts-expect-error testing invalid mode fallback
    expect(getPresetById("unknown")).toEqual(timerPresets[0])
  })

  it("persists and reads preferred mode from localStorage", () => {
    expect(getPreferredMode()).toBe("pomodoro")

    setPreferredMode("deep-work")
    expect(getPreferredMode()).toBe("deep-work")

    setPreferredMode("stopwatch")
    expect(getPreferredMode()).toBe("stopwatch")
  })

  it("persists and manages session mode per session id", () => {
    const sessionId = "session-123"
    setSessionMode(sessionId, "deep-work")
    expect(getSessionMode(sessionId)).toBe("deep-work")

    clearSessionMode(sessionId)
    expect(getSessionMode(sessionId)).toBe("deep-work") // falls back to preferred
  })

  it("executes playTimerChime safely without throwing", () => {
    expect(() => playTimerChime()).not.toThrow()
  })
})
