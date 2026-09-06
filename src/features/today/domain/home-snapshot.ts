import type { TodayCard } from "../types"
import type { QuestView } from "@/features/quests/domain/types"
import { resolveClassification } from "@/features/quests/domain/classification"

export function homeQuestSnapshot(card: TodayCard): QuestView {
  return {
    ...resolveClassification(card),
    id: card.id,
    title: card.title,
    description: card.description ?? "",
    priority: card.priority,
    status: card.status,
    version: card.version,
    completedAt: card.completedAt ?? null,
    deletedAt: card.deletedAt ?? null,
    startAt: card.startAt ?? null,
    dueAt: card.dueAt ?? null,
    gateName: card.gateName ?? null,
    labels: card.labels ?? [],
    position: card.position ?? 0,
    parentTaskId: card.parentTaskId ?? null,
    projectId: card.projectId ?? null,
    recurrenceOccurrenceAt: card.recurrenceOccurrenceAt ?? null,
    recurrenceRule: card.recurrenceRule ?? null,
    recurrenceSequence: card.recurrenceSequence ?? null,
    recurrenceSeriesId: card.recurrenceSeriesId ?? null,
    recurrenceTimezone: card.recurrenceTimezone ?? null,
    subquestCount: card.steps,
  }
}
