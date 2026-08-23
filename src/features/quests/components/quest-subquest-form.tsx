"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import {
  createQuestAction,
  type QuestActionState,
} from "@/features/quests/application/actions"
import {
  QuestFormFields,
  type QuestGateOption,
} from "@/features/quests/components/quest-form-fields"
import type { QuestView } from "@/features/quests/domain/types"
import { defaultTimezone } from "@/features/reminders/domain/timezone"

const initialState: QuestActionState = null

/**
 * Inline create form pinned to a parent Quest, used by the "Add Subquest"
 * control. Depth limits are enforced server-side; the control itself is
 * only offered while the parent sits above the maximum depth.
 */
export function QuestSubquestForm({
  gates,
  parentQuest,
  timezone = defaultTimezone,
}: Readonly<{
  gates?: readonly QuestGateOption[] | undefined
  parentQuest: QuestView
  timezone?: string | undefined
}>) {
  const [state, formAction] = useActionState(createQuestAction, initialState)

  useEffect(() => {
    if (state?.ok) {
      toast.success(`Subtask added under “${parentQuest.title}”`)
    }
  }, [parentQuest.title, state])

  return (
    <form
      action={formAction}
      className="mt-3 grid gap-4 rounded-panel border border-border-soft bg-surface-inset p-4"
    >
      <input name="parentTaskId" type="hidden" value={parentQuest.id} />
      <QuestFormFields
        fieldErrors={state && !state.ok ? state.error.fieldErrors : undefined}
        gates={gates}
        idPrefix={`subquest-${parentQuest.id}`}
        timezone={timezone}
      />
      {state && !state.ok ? (
        <p aria-live="polite" className="text-sm text-danger" role="alert">
          {state.error.message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <MutationSubmitButton
          idleLabel="Create Subtask"
          pendingLabel="Creating Subtask"
        />
      </div>
    </form>
  )
}
