import { z } from "zod"

import { questPriorities } from "@/features/quests/domain/types"
import { taskTypes } from "@/features/quests/domain/classification"

const createPayloadSchema = z
  .object({
    customType: z.string().max(64).optional(),
    description: z.string().max(5_000),
    dueAt: z.string().max(32),
    parentTaskId: z.string().max(36),
    priority: z.enum(questPriorities),
    projectId: z.string().max(36),
    recurrenceRule: z.string().max(512),
    startAt: z.string().max(32),
    taskType: z.enum(taskTypes).optional(),
    title: z.string().trim().min(1).max(160),
  })
  .strict()

const completePayloadSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    questId: z.uuid(),
    title: z.string().max(160),
  })
  .strict()

const editPayloadSchema = createPayloadSchema.extend({
  expectedVersion: z.number().int().positive(),
  questId: z.uuid(),
})

export const offlineMutationRequestSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: z.uuid(),
      workspaceId: z.uuid(),
      type: z.literal("classify"),
      payload: completePayloadSchema
        .extend({
          customType: z.string().max(64).optional(),
          taskType: z.enum(taskTypes).optional(),
        })
        .refine(
          (value) =>
            value.taskType !== undefined || value.customType !== undefined,
        ),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      payload: createPayloadSchema,
      type: z.literal("create"),
      workspaceId: z.uuid(),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      payload: completePayloadSchema,
      type: z.literal("complete"),
      workspaceId: z.uuid(),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      payload: editPayloadSchema,
      type: z.literal("edit"),
      workspaceId: z.uuid(),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      payload: completePayloadSchema,
      type: z.enum(["delete", "reopen"]),
      workspaceId: z.uuid(),
    })
    .strict(),
])

export type OfflineMutationRequest = z.infer<
  typeof offlineMutationRequestSchema
>
