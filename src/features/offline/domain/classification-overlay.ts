import type { OfflineMutation } from "./types"
import type { QuestView } from "@/features/quests/domain/types"
import {
  classificationAfterEdit,
  resolveClassification,
} from "@/features/quests/domain/classification"

export function applyOfflineClassifications(
  quests: readonly QuestView[],
  mutations: readonly OfflineMutation[],
): QuestView[] {
  return quests.map((quest) => {
    let classification = resolveClassification(quest)
    for (const mutation of [...mutations].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )) {
      if (mutation.type === "create" || mutation.payload.questId !== quest.id)
        continue
      if (mutation.type === "edit")
        classification = classificationAfterEdit(
          classification,
          mutation.payload.title,
          mutation.payload.description,
        )
      if (mutation.type === "classify")
        classification = {
          ...classification,
          ...(mutation.payload.taskType !== undefined
            ? { taskType: mutation.payload.taskType, typeManual: true }
            : {}),
          ...(mutation.payload.customType !== undefined
            ? { customType: mutation.payload.customType, typeManual: true }
            : {}),
        }
    }
    return { ...quest, ...classification }
  })
}
