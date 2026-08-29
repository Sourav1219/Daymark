"use client"

import { useActionState, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Flag, WandSparkles } from "lucide-react"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import {
  createQuestAction,
  type QuestActionState,
} from "@/features/quests/application/actions"
import {
  QuestFormFields,
  type QuestGateOption,
  type QuestParentOption,
} from "@/features/quests/components/quest-form-fields"
import {
  TaskCreatedPopup,
  type CreatedTaskNotice,
} from "@/features/quests/components/task-created-popup"
import { questHomeHref } from "@/features/quests/domain/quest-links"
import type { QuestView } from "@/features/quests/domain/types"
import {
  defaultTimezone,
  timezoneAbbreviation,
} from "@/features/reminders/domain/timezone"
import { useOffline } from "@/features/offline/components/offline-provider"

const initialState: QuestActionState = null

export function QuestCreateForm({
  gates,
  onOfflineQueued,
  parentOptions,
  timezone = defaultTimezone,
}: Readonly<{
  gates?: readonly QuestGateOption[] | undefined
  onOfflineQueued?: ((quest: QuestView) => void) | undefined
  parentOptions?: readonly QuestParentOption[] | undefined
  timezone?: string | undefined
}>) {
  const [state, formAction] = useActionState(createQuestAction, initialState)
  const [createdTask, setCreatedTask] = useState<CreatedTaskNotice | null>(null)
  const submittingRef = useRef(false)
  const submittedTitleRef = useRef("New task")
  const { queueCreate } = useOffline()
  const router = useRouter()

  useEffect(() => {
    if (state?.ok) {
      // Start the fresh Home request before painting the success notice, so
      // the created task is ready when the user chooses Continue.
      router.prefetch(questHomeHref(state.data.id))
      setCreatedTask({
        id: state.data.id,
        title: submittedTitleRef.current,
        version: state.data.version,
      })
    }
    if (state) {
      submittingRef.current = false
    }
  }, [router, state])

  const dismissCreatedTask = useCallback(() => setCreatedTask(null), [])

  useEffect(() => {
    function focusNewQuest() {
      if (window.location.hash === "#create-quest-title") {
        document.getElementById("create-quest-title")?.focus()
      }
    }

    focusNewQuest()
    window.addEventListener("hashchange", focusNewQuest)
    return () => window.removeEventListener("hashchange", focusNewQuest)
  }, [])

  async function submitQuest(formData: FormData) {
    if (submittingRef.current) return

    submittingRef.current = true
    submittedTitleRef.current =
      String(formData.get("title") ?? "").trim() || "New task"

    if (navigator.onLine) {
      formAction(formData)
      return
    }

    try {
      const quest = await queueCreate(formData)
      onOfflineQueued?.(quest)
      toast.success("Task creation queued for reconnection")
    } catch {
      toast.error("The offline task could not be saved locally.")
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <>
      {createdTask ? (
        <TaskCreatedPopup
          key={createdTask.id}
          onDismiss={dismissCreatedTask}
          task={createdTask}
        />
      ) : null}
      <Card className="quest-create-card scroll-mt-20">
        <CardHeader className="quest-create-card__header">
          <span className="quest-create-card__icon">
            <WandSparkles aria-hidden="true" strokeWidth={2.25} />
          </span>
          <div>
            <CardTitle className="quest-create-card__title">New task</CardTitle>
            <CardDescription>
              Turn an intention into something you can finish.
            </CardDescription>
          </div>
          <span className="quest-create-card__timezone" title={timezone}>
            <Flag aria-hidden="true" />
            {timezoneAbbreviation(timezone)}
          </span>
        </CardHeader>
        <CardContent className="quest-create-card__content">
          <form
            action={submitQuest}
            className="grid gap-5"
            key={state?.ok ? state.data.id : "create-quest"}
            onKeyDown={(event) => {
              if (
                (event.metaKey || event.ctrlKey) &&
                (event.key === "Enter" || event.key === "NumpadEnter")
              ) {
                event.preventDefault()
                event.currentTarget.requestSubmit()
              }
            }}
          >
            <QuestFormFields
              fieldErrors={
                state && !state.ok ? state.error.fieldErrors : undefined
              }
              gates={gates}
              idPrefix="create-quest"
              parentOptions={parentOptions}
              timezone={timezone}
              variant="create"
            />
            {state && !state.ok ? (
              <p
                aria-live="polite"
                className="text-sm text-danger"
                role="alert"
              >
                {state.error.message}
              </p>
            ) : null}
            <div className="quest-create-card__footer">
              <MutationSubmitButton
                className="quest-composer__submit"
                idleLabel="Create Task"
                pendingLabel="Creating Task"
              />
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
