import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  createLabelSchema,
  editLabelSchema,
  labelTransitionSchema,
  setQuestLabelsSchema,
} from "@/features/labels/validation/label-validation"

const validLabel = {
  colorToken: "spectral-cyan",
  name: "Side Content",
}

describe("Label validation", () => {
  it("normalizes a valid create command", () => {
    expect(createLabelSchema.parse(validLabel)).toEqual(validLabel)
  })

  it("rejects blank names, oversized names, and unknown color tokens", () => {
    expect(
      createLabelSchema.safeParse({ ...validLabel, name: "  " }).success,
    ).toBe(false)
    expect(
      createLabelSchema.safeParse({ ...validLabel, name: "x".repeat(61) })
        .success,
    ).toBe(false)
    expect(
      createLabelSchema.safeParse({ ...validLabel, colorToken: "neon-pink" })
        .success,
    ).toBe(false)
  })

  it("requires valid identifiers and positive optimistic versions", () => {
    const labelId = randomUUID()
    expect(
      labelTransitionSchema.safeParse({ expectedVersion: 1, labelId }).success,
    ).toBe(true)
    expect(
      labelTransitionSchema.safeParse({ expectedVersion: 0, labelId }).success,
    ).toBe(false)
    expect(
      editLabelSchema.safeParse({
        ...validLabel,
        expectedVersion: 1,
        labelId: "not-a-uuid",
      }).success,
    ).toBe(false)
  })
})

describe("setQuestLabelsSchema", () => {
  const questId = randomUUID()
  const labelId = randomUUID()

  it("accepts an explicit label id array", () => {
    expect(
      setQuestLabelsSchema.parse({
        expectedVersion: 1,
        labelIds: [labelId],
        questId,
      }),
    ).toMatchObject({ labelIds: [labelId] })
  })

  it("parses comma-separated ids from form data and empty as detach", () => {
    const secondLabelId = randomUUID()
    expect(
      setQuestLabelsSchema.parse({
        expectedVersion: "1",
        labelIds: `${labelId},${secondLabelId}`,
        questId,
      }).labelIds,
    ).toEqual([labelId, secondLabelId])
    expect(
      setQuestLabelsSchema.parse({
        expectedVersion: 1,
        labelIds: "",
        questId,
      }).labelIds,
    ).toEqual([])
  })

  it("rejects invalid ids and caps the label count", () => {
    expect(
      setQuestLabelsSchema.safeParse({
        expectedVersion: 1,
        labelIds: ["not-a-uuid"],
        questId,
      }).success,
    ).toBe(false)
    expect(
      setQuestLabelsSchema.safeParse({
        expectedVersion: 1,
        labelIds: Array.from({ length: 21 }, () => randomUUID()),
        questId,
      }).success,
    ).toBe(false)
    const duplicateId = randomUUID()
    expect(
      setQuestLabelsSchema.safeParse({
        expectedVersion: 1,
        labelIds: [duplicateId, duplicateId],
        questId,
      }).success,
    ).toBe(false)
  })
})
