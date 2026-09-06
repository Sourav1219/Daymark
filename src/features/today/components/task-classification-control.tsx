"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Check, Pencil } from "lucide-react"
import { toast } from "sonner"
import {
  taskTypes,
  typeLabels,
  formatTaskTypeLabel,
  resolveClassification,
  type TaskClassification,
  type TaskType,
} from "@/features/quests/domain/classification"
import {
  questPriorities,
  type QuestPriority,
} from "@/features/quests/domain/types"
import type { ClassifyQuestCommand } from "@/features/quests/validation/classification-validation"
import { classifyQuestAction } from "@/features/quests/application/actions"
import { useOptionalOffline } from "@/features/offline/components/offline-provider"
import type { TodayCard } from "@/features/today/types"

const priorityLabels: Record<QuestPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

export function TaskClassificationControl({
  card,
  onClassified,
}: Readonly<{
  card: TodayCard
  onClassified?:
    | ((
        id: string,
        value: TaskClassification,
        version: number,
        priority?: QuestPriority,
      ) => void)
    | undefined
}>) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(() => resolveClassification(card))
  const [selectedType, setSelectedType] = useState<TaskType>(value.taskType)
  const [customInput, setCustomInput] = useState(value.customType ?? "")
  const [selectedPriority, setSelectedPriority] = useState<QuestPriority>(
    card.priority,
  )
  const [version, setVersion] = useState(card.version)
  const [source, setSource] = useState(card)
  const containerRef = useRef<HTMLDivElement>(null)

  if (source !== card) {
    setSource(card)
    const resolved = resolveClassification(card)
    setValue(resolved)
    setSelectedType(resolved.taskType)
    setCustomInput(resolved.customType ?? "")
    setSelectedPriority(card.priority)
    setVersion(card.version)
  }

  const [pending, startTransition] = useTransition()
  const offline = useOptionalOffline()

  // Auto-close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  function save(change: {
    taskType?: TaskType
    customType?: string | null
    priority?: QuestPriority
  }) {
    const nextClassification: TaskClassification = {
      taskType: change.taskType ?? value.taskType,
      customType:
        change.customType !== undefined ? change.customType : value.customType,
      typeManual: change.taskType !== undefined ? true : value.typeManual,
    }
    startTransition(async () => {
      try {
        const input: ClassifyQuestCommand = {
          expectedVersion: version,
          questId: card.id,
          ...(change.taskType ? { taskType: change.taskType } : {}),
          ...(change.customType !== undefined
            ? { customType: change.customType }
            : {}),
          ...(change.priority ? { priority: change.priority } : {}),
        }
        if (offline?.isOffline) {
          await offline.queueClassification({ ...input, title: card.title })
          setValue(nextClassification)
          if (change.priority) setSelectedPriority(change.priority)
          onClassified?.(card.id, nextClassification, version, change.priority)
          toast.success(
            "Classification saved offline. It will sync when connected.",
          )
        } else {
          const result = await classifyQuestAction(input)
          if (!result.ok) {
            toast.error(result.error.message)
            return
          }
          setValue(nextClassification)
          if (change.priority) setSelectedPriority(change.priority)
          setVersion(result.data.version)
          onClassified?.(
            card.id,
            nextClassification,
            result.data.version,
            change.priority,
          )
        }
      } catch {
        toast.error("Could not save classification. Please retry.")
      }
    })
  }

  return (
    <div className="task-classification" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label={`Classify ${card.title}: ${formatTaskTypeLabel(value)}`}
        className="task-classification__trigger"
        data-type={value.taskType}
        onClick={() => {
          setSelectedType(value.taskType)
          setCustomInput(value.customType ?? "")
          setSelectedPriority(card.priority)
          setOpen(!open)
        }}
        type="button"
      >
        <span>{formatTaskTypeLabel(value)}</span>
        <Pencil aria-hidden="true" />
      </button>
      {open ? (
        <div
          aria-label={`Classification for ${card.title}`}
          className="home-choice-panel task-classification__panel"
        >
          <div className="home-choice-panel__heading">
            <span>Task type</span>
          </div>
          <fieldset disabled={pending}>
            <div className="home-choice-grid">
              {taskTypes.map((type) => (
                <button
                  aria-pressed={selectedType === type}
                  data-type={type}
                  key={type}
                  onClick={() => {
                    if (type === "custom") {
                      setSelectedType("custom")
                    } else {
                      setSelectedType(type)
                      save({ taskType: type, customType: null })
                    }
                  }}
                  type="button"
                >
                  {typeLabels[type]}
                </button>
              ))}
            </div>
          </fieldset>
          {selectedType === "custom" ? (
            <form
              className="task-classification__custom-form"
              onSubmit={(e) => {
                e.preventDefault()
                save({
                  taskType: "custom",
                  customType: customInput.trim() || null,
                })
              }}
            >
              <input
                autoFocus
                className="task-classification__custom-input"
                maxLength={64}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Enter custom type..."
                type="text"
                value={customInput}
              />
              <button
                className="task-classification__custom-save"
                type="submit"
              >
                Save
              </button>
            </form>
          ) : null}

          <div
            className="home-choice-panel__heading"
            style={{ marginTop: "0.55rem" }}
          >
            <span>Priority</span>
          </div>
          <fieldset disabled={pending}>
            <div className="home-choice-grid task-priority-grid">
              {questPriorities.map((p) => (
                <button
                  aria-pressed={selectedPriority === p}
                  data-priority={p}
                  key={p}
                  onClick={() => {
                    setSelectedPriority(p)
                    save({ priority: p })
                  }}
                  type="button"
                >
                  {priorityLabels[p]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="task-classification__footer">
            <p role="status">
              {pending
                ? "Saving…"
                : value.typeManual
                  ? "Your choice is saved."
                  : "Suggested from your task. Change whenever you like."}
            </p>
            <button
              aria-label="Done editing classification"
              className="task-classification__done"
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
            >
              <Check aria-hidden="true" />
              <span>Done</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
