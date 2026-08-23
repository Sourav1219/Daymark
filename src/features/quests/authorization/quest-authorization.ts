import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { QuestServiceError } from "@/features/quests/domain/errors"

const questMemberRoles = new Set(["owner", "admin", "member"])

export function canManageQuests(access: AccessContext): boolean {
  return questMemberRoles.has(access.role)
}

export function authorizeQuestAccess(access: AccessContext): void {
  if (!canManageQuests(access)) {
    throw new QuestServiceError(
      "FORBIDDEN",
      "This workspace role cannot manage tasks.",
    )
  }
}
