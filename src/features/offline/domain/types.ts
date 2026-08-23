import type { QuestView } from "@/features/quests/domain/types"

import type { QuestStatus } from "@/features/quests/domain/types"

export type OfflineScope = Readonly<{
  key: string
  userId: string
  userName: string
  workspaceId: string
  workspaceName: string
}>

export type OfflineQuestConflict = Readonly<{
  message: string
  serverQuest: Readonly<{
    id: string
    status: QuestStatus
    title: string
    version: number
  }> | null
}>

export type OfflineCreatePayload = Readonly<{
  description: string
  dueAt: string
  parentTaskId: string
  priority: string
  projectId: string
  recurrenceRule: string
  startAt: string
  title: string
}>

export type OfflineEditPayload = OfflineCreatePayload &
  Readonly<{
    expectedVersion: number
    questId: string
  }>

export type OfflineTransitionPayload = Readonly<{
  expectedVersion: number
  questId: string
  title: string
}>

export type OfflineMutation =
  | Readonly<{
      conflict: OfflineQuestConflict | null
      createdAt: string
      id: string
      optimisticQuest: QuestView
      payload: OfflineCreatePayload
      scopeKey: string
      status: "conflict" | "pending"
      type: "create"
      workspaceId: string
    }>
  | Readonly<{
      conflict: OfflineQuestConflict | null
      createdAt: string
      id: string
      payload: OfflineTransitionPayload
      scopeKey: string
      status: "conflict" | "pending"
      type: "complete"
      workspaceId: string
    }>
  | Readonly<{
      conflict: OfflineQuestConflict | null
      createdAt: string
      id: string
      payload: OfflineEditPayload
      scopeKey: string
      status: "conflict" | "pending"
      type: "edit"
      workspaceId: string
    }>
  | Readonly<{
      conflict: OfflineQuestConflict | null
      createdAt: string
      id: string
      payload: OfflineTransitionPayload
      scopeKey: string
      status: "conflict" | "pending"
      type: "delete" | "reopen"
      workspaceId: string
    }>

export type OfflineMutationResult =
  | Readonly<{
      mutationId: string
      quest: Readonly<{ id: string; version: number }>
      status: "applied"
    }>
  | Readonly<{
      conflict: OfflineQuestConflict
      mutationId: string
      status: "conflict"
    }>
  | Readonly<{
      message: string
      mutationId: string
      status: "rejected"
    }>

export function offlineScopeKey(userId: string, workspaceId: string) {
  return `${userId}:${workspaceId}`
}
