import type { Route } from "next"

export const focusTodayTaskEvent = "traketo:focus-today-task"
export const taskCompletionUndoEvent = "traketo:task-completion-undo"

export type TaskCompletionUndoEventDetail = Readonly<{
  phase: "confirmed" | "failed" | "started"
  questId: string
  version?: number | undefined
}>

export function questHomeHref(questId: string, selectedDate?: string | null) {
  const params = new URLSearchParams()
  if (selectedDate) params.set("date", selectedDate)
  params.set("task", questId)

  return `/today?${params.toString()}` as Route
}

export function todayTaskElementId(questId: string) {
  return `today-task-${questId}`
}
