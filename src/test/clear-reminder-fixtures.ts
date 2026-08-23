import type { Database } from "@/db/client"
import {
  activityEvents,
  attachments,
  groupStudyActivities,
  groupStudyParticipants,
  groupStudySessions,
  inAppNotifications,
  reminderDeliveries,
  reminders,
  timerSessions,
  userProgression,
  xpLedger,
} from "@/db/schema"

/** Removes cross-feature dependent rows before integration suites delete users. */
export async function clearReminderFixtures(database: Database) {
  await database.delete(groupStudyActivities)
  await database.delete(groupStudyParticipants)
  await database.delete(groupStudySessions)
  await database.delete(timerSessions)
  await database.delete(attachments)
  await database.delete(inAppNotifications)
  await database.delete(reminderDeliveries)
  await database.delete(reminders)
  await database.delete(userProgression)
  await database.delete(xpLedger)
  await database.delete(activityEvents)
}
