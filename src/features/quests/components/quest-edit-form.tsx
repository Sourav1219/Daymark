"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import {
  editQuestAction,
  type QuestActionState,
} from "@/features/quests/application/actions"
import {
  QuestFormFields,
  type QuestGateOption,
  type QuestParentOption,
} from "@/features/quests/components/quest-form-fields"
import type { QuestView } from "@/features/quests/domain/types"
import { defaultTimezone } from "@/features/reminders/domain/timezone"
import { useOffline } from "@/features/offline/components/offline-provider"

const initialState: QuestActionState = null

export function QuestEditForm({
  gates,
  parentOptions,
  quest,
  timezone = defaultTimezone,
}: Readonly<{
  gates?: readonly QuestGateOption[] | undefined
  parentOptions?: readonly QuestParentOption[] | undefined
  quest: QuestView
  timezone?: string | undefined
}>) {
  const [state, formAction] = useActionState(editQuestAction, initialState)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const { queueEdit } = useOffline()

  useEffect(() => {
    if (state?.ok) {
      if (detailsRef.current) {
        detailsRef.current.open = false
      }
      toast.success("Task details updated")
    }
  }, [state])

  return (
    <details className="group/edit" ref={detailsRef}>
      <summary className="motion-interactive w-fit cursor-pointer rounded-control px-2 py-1 text-sm font-medium text-system-blue hover:text-spectral-cyan focus-visible:outline-none">
        Edit Task
      </summary>
      <form
        action={formAction}
        className="mt-4 grid gap-5 rounded-panel border border-border-soft bg-surface-inset p-4"
        onSubmit={(event) => {
          if (navigator.onLine) return
          event.preventDefault()
          const form = event.currentTarget
          void queueEdit(quest, new FormData(form))
            .then(() => {
              if (detailsRef.current) detailsRef.current.open = false
              toast.success("Task edit queued for reconnection")
            })
            .catch(() => toast.error("The offline edit could not be saved."))
        }}
      >
        <input name="questId" type="hidden" value={quest.id} />
        <input name="expectedVersion" type="hidden" value={quest.version} />
        <QuestFormFields
          defaults={quest}
          fieldErrors={state && !state.ok ? state.error.fieldErrors : undefined}
          gates={gates}
          idPrefix={`edit-${quest.id}`}
          parentOptions={parentOptions}
          selfQuestId={quest.id}
          timezone={timezone}
        />
        {state && !state.ok ? (
          <p aria-live="polite" className="text-sm text-danger" role="alert">
            {state.error.message}
          </p>
        ) : null}
        <div className="flex justify-end">
          <MutationSubmitButton
            idleLabel="Save changes"
            pendingLabel="Saving changes"
          />
        </div>
      </form>
    </details>
  )
}
