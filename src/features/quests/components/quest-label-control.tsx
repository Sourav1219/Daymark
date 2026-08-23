"use client"

import { toast } from "sonner"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import { setQuestLabelsAction } from "@/features/labels/application/actions"
import type { QuestView } from "@/features/quests/domain/types"

type QuestLabelOption = Readonly<{
  id: string
  name: string
  colorToken: string
}>

const labelDotStyles: Record<string, string> = {
  "mana-violet": "bg-mana-violet",
  "spectral-cyan": "bg-spectral-cyan",
  "status-danger": "bg-danger",
  "status-success": "bg-success",
  "status-warning": "bg-warning",
  "system-blue": "bg-system-blue",
}

/**
 * Attach/detach Labels on a Quest. Submitting replaces the Quest's full
 * label set through the label feature's server action.
 */
export function QuestLabelControl({
  labels,
  quest,
}: Readonly<{ labels: readonly QuestLabelOption[]; quest: QuestView }>) {
  const assignedIds = new Set(quest.labels.map((label) => label.id))

  async function submitLabels(formData: FormData) {
    const result = await setQuestLabelsAction(formData)

    if (result.ok) {
      toast.success(
        result.data.assigned === 0
          ? "Labels detached from the task"
          : `Saved ${result.data.assigned} Label${result.data.assigned === 1 ? "" : "s"} on the task`,
      )
    } else {
      toast.error(result.error.message)
    }
  }

  return (
    <details>
      <summary className="motion-interactive w-fit cursor-pointer rounded-control px-2 py-1 text-sm font-medium text-system-blue hover:text-spectral-cyan focus-visible:outline-none">
        Labels ({quest.labels.length})
      </summary>
      <form
        action={submitLabels}
        className="mt-3 grid gap-3 rounded-panel border border-border-soft bg-surface-inset p-4"
      >
        <input name="questId" type="hidden" value={quest.id} />
        <input name="expectedVersion" type="hidden" value={quest.version} />
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">
            Attach Labels to this task
          </legend>
          {labels.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No Labels exist yet. Create them on the Labels page first.
            </p>
          ) : (
            labels.map((label) => (
              <label
                className="flex cursor-pointer items-center gap-2.5 text-sm"
                key={label.id}
              >
                <input
                  className="size-4 accent-system-blue"
                  defaultChecked={assignedIds.has(label.id)}
                  name="labelIds"
                  type="checkbox"
                  value={label.id}
                />
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${labelDotStyles[label.colorToken] ?? "bg-border-strong"}`}
                />
                {label.name}
              </label>
            ))
          )}
        </fieldset>
        <div className="flex justify-end">
          <MutationSubmitButton
            idleLabel="Save Labels"
            pendingLabel="Saving Labels"
          />
        </div>
      </form>
    </details>
  )
}
