import { z } from "zod"

import { labelColorTokens } from "@/features/labels/domain/types"

export const createLabelSchema = z
  .object({
    colorToken: z.enum(labelColorTokens, {
      error: "Choose a valid color token.",
    }),
    name: z
      .string()
      .trim()
      .min(1, "Give this label a name.")
      .max(60, "Name must be 60 characters or fewer."),
  })
  .strict()

export const editLabelSchema = z
  .object({
    colorToken: z.enum(labelColorTokens, {
      error: "Choose a valid color token.",
    }),
    expectedVersion: z.coerce.number().int().positive(),
    labelId: z.uuid(),
    name: z
      .string()
      .trim()
      .min(1, "Give this label a name.")
      .max(60, "Name must be 60 characters or fewer."),
  })
  .strict()

export const labelTransitionSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    labelId: z.uuid(),
  })
  .strict()

export const setQuestLabelsSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    labelIds: z
      .preprocess(
        (value) =>
          typeof value === "string" ? value.split(",").filter(Boolean) : value,
        z.array(z.uuid()).max(20, "A task can have at most 20 labels."),
      )
      .refine(
        (labelIds) => new Set(labelIds).size === labelIds.length,
        "Choose each Label only once.",
      ),
    questId: z.uuid(),
  })
  .strict()

export type CreateLabelCommand = z.output<typeof createLabelSchema>
export type EditLabelCommand = z.output<typeof editLabelSchema>
export type LabelTransitionCommand = z.output<typeof labelTransitionSchema>
export type SetQuestLabelsCommand = z.output<typeof setQuestLabelsSchema>
