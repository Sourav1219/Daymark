import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { LabelServiceError } from "@/features/labels/domain/errors"

const labelMemberRoles = new Set(["owner", "admin", "member"])

function canManageLabels(access: AccessContext): boolean {
  return labelMemberRoles.has(access.role)
}

export function authorizeLabelAccess(access: AccessContext): void {
  if (!canManageLabels(access)) {
    throw new LabelServiceError(
      "FORBIDDEN",
      "This workspace role cannot manage Labels.",
    )
  }
}
