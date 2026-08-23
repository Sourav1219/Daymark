import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  createGateSchema,
  editGateSchema,
  gateTransitionSchema,
} from "@/features/gates/validation/gate-validation"

const validGate = {
  accentToken: "mana-violet",
  description: "A campaign container.",
  name: "Arc I",
}

describe("Gate validation", () => {
  it("normalizes a valid create command", () => {
    expect(createGateSchema.parse(validGate)).toEqual(validGate)
  })

  it("defaults a missing description to an empty string", () => {
    expect(
      createGateSchema.parse({
        accentToken: "system-blue",
        name: "Arc II",
      }),
    ).toMatchObject({ description: "" })
  })

  it("rejects blank names, oversized names, and unknown accent tokens", () => {
    expect(
      createGateSchema.safeParse({ ...validGate, name: "   " }).success,
    ).toBe(false)
    expect(
      createGateSchema.safeParse({ ...validGate, name: "x".repeat(121) })
        .success,
    ).toBe(false)
    expect(
      createGateSchema.safeParse({ ...validGate, accentToken: "neon-pink" })
        .success,
    ).toBe(false)
  })

  it("rejects unknown input keys", () => {
    expect(
      createGateSchema.safeParse({ ...validGate, workspaceId: randomUUID() })
        .success,
    ).toBe(false)
  })

  it("requires valid identifiers and positive optimistic versions", () => {
    const gateId = randomUUID()
    expect(
      gateTransitionSchema.safeParse({ expectedVersion: 1, gateId }).success,
    ).toBe(true)
    expect(
      gateTransitionSchema.safeParse({ expectedVersion: 0, gateId }).success,
    ).toBe(false)
    expect(
      editGateSchema.safeParse({
        ...validGate,
        expectedVersion: 1,
        gateId: "not-a-uuid",
      }).success,
    ).toBe(false)
    expect(
      editGateSchema.safeParse({
        ...validGate,
        expectedVersion: "2",
        gateId,
      }).success,
    ).toBe(true)
  })
})
