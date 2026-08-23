import type { TimerSessionStatus } from "@/features/timer/domain/types"

export function calculateTimerElapsedMs(
  input: Readonly<{
    accumulatedMs: number
    lastStartedAt: Date | string | null
    nowMs: number
    status: TimerSessionStatus
  }>,
) {
  if (input.status !== "running" || !input.lastStartedAt) {
    return input.accumulatedMs
  }

  const lastStartedMs =
    input.lastStartedAt instanceof Date
      ? input.lastStartedAt.getTime()
      : Date.parse(input.lastStartedAt)
  return input.accumulatedMs + Math.max(0, input.nowMs - lastStartedMs)
}
