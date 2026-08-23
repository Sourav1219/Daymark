import type { WorkspaceRole } from "@/features/workspaces/domain/workspace-role"

export type AccessContext = Readonly<{
  userId: string
  workspaceId: string
  role: WorkspaceRole
}>
