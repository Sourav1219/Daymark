export const reminderChannels = ["in_app", "email"] as const

export type ReminderChannel = (typeof reminderChannels)[number]
export type ReminderStatus =
  "cancelled" | "delivered" | "failed" | "pending" | "processing" | "retrying"
export type ReminderDeliveryStatus = "delivered" | "failed" | "processing"

export type ReminderView = Readonly<{
  attemptCount: number
  channel: ReminderChannel
  id: string
  questId: string
  questTitle: string
  remindAt: string
  status: ReminderStatus
  timezone: string
  version: number
}>

export type NotificationView = Readonly<{
  createdAt: string
  dueAt: string | null
  id: string
  questId: string
  questTitle: string
  readAt: string | null
}>

export type DueSoonQuestView = Readonly<{
  dueAt: string
  id: string
  title: string
}>

export type ReminderInboxData = Readonly<{
  dueSoonQuests: readonly DueSoonQuestView[]
}>
