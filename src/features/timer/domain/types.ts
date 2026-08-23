export const timerSessionStatuses = ["running", "paused", "completed"] as const

export type TimerSessionStatus = (typeof timerSessionStatuses)[number]

export const groupStudySessionStatuses = ["active", "closed"] as const
export type GroupStudySessionStatus = (typeof groupStudySessionStatuses)[number]

export const groupStudyActivityActions = [
  "joined",
  "paused",
  "resumed",
  "left",
  "removed",
  "blocked",
] as const
export type GroupStudyActivityAction =
  (typeof groupStudyActivityActions)[number]

export type GroupStudyParticipantView = Readonly<{
  accumulatedMs: number
  id: string
  isCurrentUser: boolean
  isHost: boolean
  joinedAt: string
  lastStartedAt: string | null
  name: string
  status: Exclude<TimerSessionStatus, "completed">
  subject: string
  timerSessionId: string
  userId: string
}>

export type GroupStudyActivityView = Readonly<{
  action: GroupStudyActivityAction
  id: string
  name: string
  occurredAt: string
  timerElapsedMs: number
  userId: string
}>

export type GroupStudyJoinRequestView = Readonly<{
  id: string
  userId: string
  name: string
  createdAt: string
}>

export type GroupStudySessionView = Readonly<{
  activities: readonly GroupStudyActivityView[]
  createdAt: string
  id: string
  isHost: boolean
  joinCode: string
  joinLocked: boolean
  name: string
  participantLimit: number
  participants: readonly GroupStudyParticipantView[]
  joinRequests: readonly GroupStudyJoinRequestView[]
  subject: string
  version: number
}>

export type GroupStudyParticipantSummaryView = Readonly<{
  joinedAt: string
  leftAt: string | null
  name: string
  totalMs: number
  userId: string
}>

export type GroupStudyHistoryView = Readonly<{
  activities: readonly GroupStudyActivityView[]
  durationMs: number | null
  endedAt: string | null
  id: string
  joinedAt: string
  leftAt: string
  name: string
  participants: readonly GroupStudyParticipantSummaryView[]
  subject: string
  totalFocusMs: number
}>

export type TimerSessionView = Readonly<{
  accumulatedMs: number
  createdAt: string
  endedAt: string | null
  id: string
  lastStartedAt: string | null
  startedAt: string
  status: TimerSessionStatus
  subject: string
  updatedAt: string
  version: number
}>

export type DailyStudySummaryView = Readonly<{
  localDate: string
  sessionCount: number
  totalMs: number
}>

export type TimerDashboardView = Readonly<{
  activeSession: TimerSessionView | null
  completedCount: number
  history: readonly TimerSessionView[]
  localDate: string
  sharedHistory: readonly GroupStudyHistoryView[]
  serverNow: string
  sharedSession: GroupStudySessionView | null
  pendingJoinRequest: GroupStudyJoinRequestView | null
  timezone: string
  totalCompletedMs: number
}>
