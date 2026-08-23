import { describe, expect, it } from "vitest"

import {
  calculateCompletionStreak,
  calculateFailurePenalty,
  calculateQuestXp,
  getLevelProgress,
  getHunterRankProgress,
  localDateForInstant,
  maximumExperiencePoints,
  maximumFailurePenalty,
} from "./progression"

describe("progression domain", () => {
  it("advances levels on an increasingly demanding points curve", () => {
    expect(getLevelProgress(-20)).toEqual({
      currentThreshold: 0,
      level: 1,
      nextThreshold: 100,
      percent: 0,
      pointsForLevel: 100,
      pointsInLevel: 0,
      pointsToNextLevel: 100,
    })
    expect(getLevelProgress(99)).toMatchObject({
      level: 1,
      percent: 99,
      pointsToNextLevel: 1,
    })
    expect(getLevelProgress(100)).toMatchObject({
      level: 2,
      pointsForLevel: 150,
      pointsInLevel: 0,
    })
    expect(getLevelProgress(385)).toMatchObject({
      level: 3,
      nextThreshold: 450,
      percent: 67,
      pointsForLevel: 200,
      pointsInLevel: 135,
      pointsToNextLevel: 65,
    })
  })

  it("calculates bounded Quest XP exclusively from priority", () => {
    expect(calculateQuestXp("low")).toBe(10)
    expect(calculateQuestXp("medium")).toBe(20)
    expect(calculateQuestXp("high")).toBe(35)
    expect(calculateQuestXp("critical")).toBe(50)
  })

  it("maps exact Hunter Rank thresholds and caps invalid totals", () => {
    expect(getHunterRankProgress(-20)).toMatchObject({ level: 1, rank: "E" })
    expect(getHunterRankProgress(249)).toMatchObject({
      nextRank: "D",
      rank: "E",
      xpToNextRank: 1,
    })
    expect(getHunterRankProgress(250)).toMatchObject({
      level: 2,
      rank: "D",
      xpIntoRank: 0,
    })
    expect(getHunterRankProgress(5_000)).toMatchObject({
      nextRank: null,
      percent: 100,
      rank: "S",
    })
    expect(getHunterRankProgress(Number.MAX_SAFE_INTEGER)).toEqual(
      getHunterRankProgress(maximumExperiencePoints),
    )
  })

  it("deduplicates same-day clears and handles current, skipped, and best streaks", () => {
    expect(
      calculateCompletionStreak(
        ["2026-08-05", "2026-08-06", "2026-08-06", "2026-08-07"],
        "2026-08-08",
      ),
    ).toEqual({
      best: 3,
      current: 3,
      lastClearedLocalDate: "2026-08-07",
    })

    expect(
      calculateCompletionStreak(
        ["2026-08-01", "2026-08-02", "2026-08-05"],
        "2026-08-08",
      ),
    ).toEqual({
      best: 2,
      current: 0,
      lastClearedLocalDate: "2026-08-05",
    })
  })

  it("assigns completion days in the configured IANA timezone", () => {
    const instant = new Date("2026-08-08T20:00:00.000Z")
    expect(localDateForInstant(instant, "Asia/Kolkata")).toBe("2026-08-09")
    expect(localDateForInstant(instant, "America/New_York")).toBe("2026-08-08")
  })
})

describe("missed task penalties", () => {
  it("charges the task's own value for the first miss of a day", () => {
    expect(calculateFailurePenalty("low", 0)).toBe(10)
    expect(calculateFailurePenalty("medium", 0)).toBe(20)
    expect(calculateFailurePenalty("high", 0)).toBe(35)
    expect(calculateFailurePenalty("critical", 0)).toBe(50)
  })

  it("escalates by five for every further miss the same day", () => {
    expect(calculateFailurePenalty("low", 1)).toBe(15)
    expect(calculateFailurePenalty("low", 2)).toBe(20)
    expect(calculateFailurePenalty("low", 3)).toBe(25)
  })

  it("caps a single penalty and ignores nonsense counts", () => {
    expect(calculateFailurePenalty("critical", 1_000)).toBe(
      maximumFailurePenalty,
    )
    expect(calculateFailurePenalty("low", -5)).toBe(10)
  })
})
