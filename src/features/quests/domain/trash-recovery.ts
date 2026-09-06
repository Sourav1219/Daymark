import { isSameZonedDate } from "@/features/reminders/domain/timezone"

type TrashRecoveryInstant = Date | string

export function canRestoreTrashedTask(
  deletedAt: TrashRecoveryInstant | null,
  restoredAt: TrashRecoveryInstant,
  timezone: string,
): boolean {
  if (!deletedAt) return false

  const deletedInstant =
    typeof deletedAt === "string" ? new Date(deletedAt) : deletedAt
  const restoredInstant =
    typeof restoredAt === "string" ? new Date(restoredAt) : restoredAt
  const deletedTimestamp = deletedInstant.getTime()
  const restoredTimestamp = restoredInstant.getTime()

  return (
    Number.isFinite(deletedTimestamp) &&
    Number.isFinite(restoredTimestamp) &&
    restoredTimestamp >= deletedTimestamp &&
    isSameZonedDate(deletedInstant, restoredInstant, timezone)
  )
}

export function canUseRestorationTimeline(
  startAt: Date,
  dueAt: Date,
  restoredAt: Date,
  timezone: string,
): boolean {
  return (
    startAt.getTime() > restoredAt.getTime() &&
    dueAt.getTime() > startAt.getTime() &&
    isSameZonedDate(startAt, restoredAt, timezone) &&
    isSameZonedDate(dueAt, restoredAt, timezone)
  )
}
