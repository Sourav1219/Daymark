import { z } from "zod"
import { taskTypes } from "@/features/quests/domain/classification"
import { questPriorities } from "@/features/quests/domain/types"

export const classifyQuestSchema = z
  .object({
    questId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    taskType: z.enum(taskTypes).optional(),
    customType: z.string().max(64).nullable().optional(),
    priority: z.enum(questPriorities).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.taskType !== undefined ||
      value.customType !== undefined ||
      value.priority !== undefined,
    "Choose a task type or priority.",
  )

export type ClassifyQuestCommand = z.infer<typeof classifyQuestSchema>
