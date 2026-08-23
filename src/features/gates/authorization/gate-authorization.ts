import type { AccessContext } from "@/features/authentication/authorization/access-context"
import { GateServiceError } from "@/features/gates/domain/errors"

const gateMemberRoles = new Set(["owner", "admin", "member"])

function canManageGates(access: AccessContext): boolean {
  return gateMemberRoles.has(access.role)
}

export function authorizeGateAccess(access: AccessContext): void {
  if (!canManageGates(access)) {
    throw new GateServiceError(
      "FORBIDDEN",
      "This workspace role cannot manage lists.",
    )
  }
}
