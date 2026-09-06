export const taskTypes = ["personal", "work", "study", "custom"] as const
export type TaskType = (typeof taskTypes)[number]

export type TaskClassification = Readonly<{
  taskType: TaskType
  customType: string | null
  typeManual: boolean
}>

export type TaskOptionalClassification = Readonly<{
  taskType?: TaskType | undefined
  customType?: string | null | undefined
  typeManual?: boolean | undefined
}>

export const typeLabels: Record<TaskType, string> = {
  personal: "Personal",
  work: "Work",
  study: "Study",
  custom: "Custom",
}

export function formatTaskTypeLabel(task: {
  taskType?: TaskType | undefined
  customType?: string | null | undefined
}): string {
  if (task.taskType === "custom") {
    const custom = task.customType?.trim()
    return custom && custom.length > 0 ? custom : "Custom"
  }
  return task.taskType ? typeLabels[task.taskType] : "Personal"
}

// Conservative, portable rules: no network, priority, or duration assumptions.
export const typeRules = [
  ["work", "client|invoice|meeting|colleague|customer|proposal|office"],
  [
    "study",
    "study|revise|revision|calculus|chapter|homework|exam|lecture|coursework",
  ],
  [
    "personal",
    "buy|groceries|detergent|laundry|clean|shopping|errand|workout|exercise|gym|doctor|dentist|meditate|meditation|yoga|jog",
  ],
] as const

function matches(text: string, terms: string) {
  return new RegExp(`\\b(?:${terms})\\b`, "iu").test(text)
}

export function suggestClassification(
  title: string,
  description = "",
): TaskClassification {
  const text = `${title} ${description}`
  const matched = typeRules.find(([, terms]) => matches(text, terms))
  return {
    taskType: (matched ? matched[0] : "personal") as TaskType,
    customType: null,
    typeManual: false,
  }
}

export function resolveClassification(
  task: {
    title: string
    description?: string | null
  } & TaskOptionalClassification,
): TaskClassification {
  const suggestion = suggestClassification(task.title, task.description ?? "")
  return {
    taskType: task.taskType ?? suggestion.taskType,
    customType: task.customType ?? null,
    typeManual: task.typeManual ?? false,
  }
}

export function classificationAfterEdit(
  current: TaskOptionalClassification,
  title: string,
  description: string,
): TaskClassification {
  const suggestion = suggestClassification(title, description)
  return {
    ...suggestion,
    ...(current.typeManual
      ? {
          taskType: current.taskType ?? "personal",
          customType: current.customType ?? null,
          typeManual: true,
        }
      : {}),
  }
}
