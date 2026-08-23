import { z } from "zod"

import {
  questDueDateFilters,
  questPriorities,
  questSortOptions,
  questStatusFilters,
  type QuestListFilters,
} from "@/features/quests/domain/types"
import {
  normalizeRecurrenceRule,
  RecurrenceRuleError,
} from "@/features/reminders/domain/recurrence"
import { parseZonedLocalDateTime } from "@/features/reminders/domain/timezone"

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u

const localUtcDateTimeSchema = z
  .string()
  .regex(localDateTimePattern, "Enter a valid date and time.")
  .refine((value) => {
    const parsed = new Date(`${value}:00.000Z`)

    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 16) === value
    )
  }, "Enter a real calendar date and time.")
  .transform((value) => new Date(`${value}:00.000Z`))

const optionalUtcDateTimeSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.union([z.date(), localUtcDateTimeSchema]).nullable(),
)

const optionalIdSchema = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined ? null : value,
  z.uuid().nullable(),
)

const optionalRecurrenceRuleSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z
    .string()
    .max(512, "Recurrence rules must be 512 characters or fewer.")
    .nullable()
    .transform((value, context) => {
      if (!value) return null

      try {
        return normalizeRecurrenceRule(value)
      } catch (error) {
        context.addIssue({
          code: "custom",
          message:
            error instanceof RecurrenceRuleError
              ? error.message
              : "Enter a valid RFC 5545 recurrence rule.",
        })
        return z.NEVER
      }
    }),
)

const questFields = {
  description: z
    .preprocess((value) => value ?? "", z.string())
    .transform((value) => value.trim())
    .pipe(
      z.string().max(5_000, "Description must be 5,000 characters or fewer."),
    ),
  dueAt: optionalUtcDateTimeSchema,
  parentTaskId: optionalIdSchema,
  priority: z.enum(questPriorities, {
    error: "Choose a valid priority.",
  }),
  projectId: optionalIdSchema,
  recurrenceRule: optionalRecurrenceRuleSchema,
  startAt: optionalUtcDateTimeSchema,
  title: z
    .string()
    .trim()
    .min(1, "Give this task a title.")
    .max(160, "Title must be 160 characters or fewer."),
} as const

function validateSchedule(
  value: {
    dueAt: Date | null
    recurrenceRule: string | null
    startAt: Date | null
  },
  context: z.RefinementCtx,
) {
  if (
    value.startAt &&
    value.dueAt &&
    value.dueAt.getTime() < value.startAt.getTime()
  ) {
    context.addIssue({
      code: "custom",
      message: "Due time cannot be earlier than start time.",
      path: ["dueAt"],
    })
  }

  if (value.recurrenceRule && !value.startAt && !value.dueAt) {
    context.addIssue({
      code: "custom",
      message: "Recurring tasks need a start or due time.",
      path: ["recurrenceRule"],
    })
  }
}

export const createQuestSchema = z
  .object(questFields)
  .strict()
  .superRefine(validateSchedule)

/**
 * Rejects a schedule that has already elapsed. Applied when parsing new-task
 * form input rather than inside createQuestSchema, so server-side callers that
 * seed historical fixtures keep working.
 */
function rejectElapsedSchedule(
  value: { dueAt: Date | null; startAt: Date | null },
  context: z.RefinementCtx,
  now: Date,
) {
  const instant = now.getTime()

  if (value.dueAt && value.dueAt.getTime() < instant) {
    context.addIssue({
      code: "custom",
      message: "That due time has already passed. Pick a later time.",
      path: ["dueAt"],
    })
  }

  if (value.startAt && value.startAt.getTime() < instant) {
    context.addIssue({
      code: "custom",
      message: "That start time has already passed. Pick a later time.",
      path: ["startAt"],
    })
  }
}

export const editQuestSchema = z
  .object({
    ...questFields,
    expectedVersion: z.coerce.number().int().positive(),
    questId: z.uuid(),
  })
  .strict()
  .superRefine(validateSchedule)

export const questTransitionSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    questId: z.uuid(),
  })
  .strict()

const restoreQuestScheduleSchema = z
  .object({
    dueAt: z.date(),
    expectedVersion: z.coerce.number().int().positive(),
    questId: z.uuid(),
    startAt: z.date(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.dueAt.getTime() < value.startAt.getTime()) {
      context.addIssue({
        code: "custom",
        message: "Due time cannot be earlier than start time.",
        path: ["dueAt"],
      })
    }
  })

const questOrderItemSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    questId: z.uuid(),
  })
  .strict()

export const questReorderSchema = z
  .object({
    quests: z
      .array(questOrderItemSchema)
      .min(2, "At least two tasks are required to change their order.")
      .max(200, "Task ordering is limited to 200 items at a time."),
  })
  .strict()
  .refine(
    ({ quests }) =>
      new Set(quests.map(({ questId }) => questId)).size === quests.length,
    { message: "A task can only appear once in an order.", path: ["quests"] },
  )

export type CreateQuestCommand = z.output<typeof createQuestSchema>
export type EditQuestCommand = z.output<typeof editQuestSchema>
export type QuestTransitionCommand = z.output<typeof questTransitionSchema>
export type RestoreQuestScheduleCommand = z.output<
  typeof restoreQuestScheduleSchema
>
export type QuestReorderCommand = z.output<typeof questReorderSchema>

function zonedFormDate(value: unknown, timezone: string): unknown {
  if (value === "" || value === undefined || value === null) return null
  if (value instanceof Date) return value

  return typeof value === "string"
    ? (parseZonedLocalDateTime(value, timezone) ?? { invalid: true })
    : value
}

/**
 * @param options.allowElapsedSchedule Skips the "already passed" rule. Used by
 *   the offline replay endpoint, where a task queued while offline may sync
 *   after its window closed and must not be silently dropped.
 * @param options.now Instant treated as the present, injectable for tests.
 */
export function parseCreateQuestForm(
  input: Readonly<Record<string, unknown>>,
  timezone: string,
  options: Readonly<{ allowElapsedSchedule?: boolean; now?: Date }> = {},
) {
  const payload = {
    ...input,
    dueAt: zonedFormDate(input.dueAt, timezone),
    startAt: zonedFormDate(input.startAt, timezone),
  }

  if (options.allowElapsedSchedule) {
    return createQuestSchema.safeParse(payload)
  }

  const now = options.now ?? new Date()

  return createQuestSchema
    .superRefine((value, context) => rejectElapsedSchedule(value, context, now))
    .safeParse(payload)
}

export function parseEditQuestForm(
  input: Readonly<Record<string, unknown>>,
  timezone: string,
) {
  return editQuestSchema.safeParse({
    ...input,
    dueAt: zonedFormDate(input.dueAt, timezone),
    startAt: zonedFormDate(input.startAt, timezone),
  })
}

export function parseRestoreQuestSchedule(
  input: Readonly<Record<string, unknown>>,
  timezone: string,
  now: Date = new Date(),
) {
  return restoreQuestScheduleSchema
    .superRefine((value, context) => {
      if (value.startAt.getTime() <= now.getTime()) {
        context.addIssue({
          code: "custom",
          message: "Choose a start time in the future.",
          path: ["startAt"],
        })
      }
      if (value.dueAt.getTime() <= now.getTime()) {
        context.addIssue({
          code: "custom",
          message: "Choose a due time in the future.",
          path: ["dueAt"],
        })
      }
    })
    .safeParse({
      ...input,
      dueAt: zonedFormDate(input.dueAt, timezone),
      startAt: zonedFormDate(input.startAt, timezone),
    })
}

/**
 * Parses shareable, URL-backed filter state. Unknown or malformed values
 * fall back to safe defaults instead of failing the request.
 */
const questFiltersSchema = z
  .object({
    due: z.enum(questDueDateFilters).catch("any"),
    gateId: z.union([z.enum(["any", "none"]), z.uuid()]).catch("any"),
    labelId: z.union([z.literal("any"), z.uuid()]).catch("any"),
    priority: z.enum(["any", "low", "medium", "high", "critical"]).catch("any"),
    search: z.string().trim().max(160).catch(""),
    sort: z.enum(questSortOptions).catch("manual"),
    status: z.enum(questStatusFilters).catch("open"),
  })
  .transform((value) => value as QuestListFilters)

export type RawSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>

function firstParam(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function parseQuestFilters(params: RawSearchParams): QuestListFilters {
  return questFiltersSchema.parse({
    due: firstParam(params.due),
    gateId: firstParam(params.gateId),
    labelId: firstParam(params.labelId),
    priority: firstParam(params.priority),
    search: firstParam(params.search),
    sort: firstParam(params.sort),
    status: firstParam(params.status),
  })
}
