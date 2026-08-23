"use client"

import { Flame } from "lucide-react"

import { useStreakCelebration } from "@/features/quests/components/task-completion-celebration-provider"

export function StreakButton({ streak }: Readonly<{ streak: number }>) {
  const showStreak = useStreakCelebration()

  return (
    <button
      aria-label={`View ${streak} day streak`}
      className="today-streak"
      onClick={() => showStreak(streak)}
      type="button"
    >
      <span aria-hidden="true" className="today-streak__flame">
        <Flame />
      </span>
      {streak}
    </button>
  )
}
