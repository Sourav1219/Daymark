import { describe, expect, it } from "vitest"

import type { AccessContext } from "@/features/authentication/authorization/access-context"
import {
  authorizeQuestAccess,
  canManageQuests,
} from "@/features/quests/authorization/quest-authorization"

const access = {
  role: "member",
  userId: "00000000-0000-4000-8000-000000000001",
  workspaceId: "00000000-0000-4000-8000-000000000002",
} satisfies AccessContext

describe("Quest authorization policy", () => {
  it("allows every active workspace member role", () => {
    expect(canManageQuests(access)).toBe(true)
    expect(canManageQuests({ ...access, role: "admin" })).toBe(true)
    expect(canManageQuests({ ...access, role: "owner" })).toBe(true)
    expect(() => authorizeQuestAccess(access)).not.toThrow()
  })

  it("fails closed for an unknown runtime role", () => {
    const unsupported = {
      ...access,
      role: "observer",
    } as unknown as AccessContext

    expect(canManageQuests(unsupported)).toBe(false)
    expect(() => authorizeQuestAccess(unsupported)).toThrow(
      "This workspace role cannot manage tasks.",
    )
  })
})
