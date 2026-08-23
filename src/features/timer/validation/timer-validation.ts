import { z } from "zod"

export const timerSubjectSchema = z
  .string()
  .trim()
  .min(1, "Enter a subject for this focus session")
  .max(160, "Subject must be 160 characters or fewer")

export const startTimerSchema = z.object({
  subject: timerSubjectSchema,
})

export const groupStudyRoomNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a room name")
  .max(80, "Room name must be 80 characters or fewer")

export const groupStudyParticipantLimitSchema = z.coerce
  .number()
  .int()
  .min(2, "Allow at least 2 participants")
  .max(20, "Group Study rooms support up to 20 participants")

export const createGroupStudySchema = z.object({
  name: groupStudyRoomNameSchema,
  participantLimit: groupStudyParticipantLimitSchema,
  subject: timerSubjectSchema,
})

export const joinGroupStudySchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/u,
      "Enter a valid 8-character Group Study code",
    ),
})

export const groupStudyRoomControlSchema = z.object({ roomId: z.uuid() })

export const updateGroupStudySettingsSchema =
  groupStudyRoomControlSchema.extend({
    name: groupStudyRoomNameSchema,
    participantLimit: groupStudyParticipantLimitSchema,
    subject: timerSubjectSchema,
  })

export const setGroupStudyJoinLockedSchema = groupStudyRoomControlSchema.extend(
  { joinLocked: z.boolean() },
)

export const moderateGroupStudyParticipantSchema =
  groupStudyRoomControlSchema.extend({
    action: z.enum(["removed", "blocked"]),
    participantId: z.uuid(),
  })

export const respondToJoinRequestSchema = groupStudyRoomControlSchema.extend({
  action: z.enum(["approve", "reject"]),
  requestId: z.uuid(),
})

export const timerTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  sessionId: z.uuid(),
})

export const editTimerSubjectSchema = timerTransitionSchema.extend({
  subject: timerSubjectSchema,
})
