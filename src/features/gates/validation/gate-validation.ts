import { z } from "zod"

import { gateAccentTokens } from "@/features/gates/domain/types"

export const createGateSchema = z
  .object({
    accentToken: z.enum(gateAccentTokens, {
      error: "Choose a valid accent token.",
    }),
    description: z
      .preprocess((value) => value ?? "", z.string())
      .transform((value) => value.trim())
      .pipe(
        z.string().max(1_000, "Description must be 1,000 characters or fewer."),
      ),
    name: z
      .string()
      .trim()
      .min(1, "Give this list a name.")
      .max(120, "Name must be 120 characters or fewer."),
  })
  .strict()

export const editGateSchema = z
  .object({
    accentToken: z.enum(gateAccentTokens, {
      error: "Choose a valid accent token.",
    }),
    description: z
      .preprocess((value) => value ?? "", z.string())
      .transform((value) => value.trim())
      .pipe(
        z.string().max(1_000, "Description must be 1,000 characters or fewer."),
      ),
    expectedVersion: z.coerce.number().int().positive(),
    gateId: z.uuid(),
    name: z
      .string()
      .trim()
      .min(1, "Give this list a name.")
      .max(120, "Name must be 120 characters or fewer."),
  })
  .strict()

export const gateTransitionSchema = z
  .object({
    expectedVersion: z.coerce.number().int().positive(),
    gateId: z.uuid(),
  })
  .strict()

export type CreateGateCommand = z.output<typeof createGateSchema>
export type EditGateCommand = z.output<typeof editGateSchema>
export type GateTransitionCommand = z.output<typeof gateTransitionSchema>
