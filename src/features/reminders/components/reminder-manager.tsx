"use client"

import { useActionState, useEffect, useTransition } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BellRing, CalendarClock, X } from "lucide-react"
import { toast } from "sonner"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { questHomeHref } from "@/features/quests/domain/quest-links"
import {
  cancelReminderAction,
  createReminderAction,
  updateReminderAction,
  type ReminderActionState,
} from "@/features/reminders/application/actions"
import {
  formatZonedDateTime,
  formatZonedLocalInput,
  timezoneAbbreviation,
} from "@/features/reminders/domain/timezone"
import type {
  ReminderChannel,
  ReminderView,
} from "@/features/reminders/domain/types"

type QuestOption = Readonly<{ id: string; title: string }>

function ReminderFields({
  channel = "in_app",
  emailDeliveryEnabled,
  idPrefix,
  questId,
  quests,
  remindAt,
  timezone,
}: Readonly<{
  channel?: ReminderChannel
  emailDeliveryEnabled: boolean
  idPrefix: string
  questId?: string | undefined
  quests: readonly QuestOption[]
  remindAt?: string | undefined
  timezone: string
}>) {
  const selectClass =
    "h-8 w-full rounded-control border border-input bg-surface-inset px-2.5 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="grid gap-2 sm:col-span-3">
        <Label htmlFor={`${idPrefix}-quest`}>Task</Label>
        <select
          className={selectClass}
          defaultValue={questId ?? quests[0]?.id}
          id={`${idPrefix}-quest`}
          name="questId"
          required
        >
          {quests.map((quest) => (
            <option key={quest.id} value={quest.id}>
              {quest.title}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-time`}>
          Remind at · {timezoneAbbreviation(timezone)}
        </Label>
        <Input
          defaultValue={formatZonedLocalInput(remindAt, timezone)}
          id={`${idPrefix}-time`}
          name="remindAt"
          required
          type="datetime-local"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-channel`}>Channel</Label>
        <select
          aria-describedby={
            emailDeliveryEnabled ? undefined : `${idPrefix}-channel-hint`
          }
          className={selectClass}
          defaultValue={emailDeliveryEnabled ? channel : "in_app"}
          id={`${idPrefix}-channel`}
          name="channel"
        >
          <option value="in_app">In app</option>
          <option disabled={!emailDeliveryEnabled} value="email">
            Email + in app{emailDeliveryEnabled ? "" : " (unavailable)"}
          </option>
        </select>
        {emailDeliveryEnabled ? null : (
          <p className="text-xs text-ink-muted" id={`${idPrefix}-channel-hint`}>
            Email delivery is not configured for this deployment.
          </p>
        )}
      </div>
    </div>
  )
}

function CreateReminderForm({
  emailDeliveryEnabled,
  quests,
  timezone,
}: Readonly<{
  emailDeliveryEnabled: boolean
  quests: readonly QuestOption[]

  timezone: string
}>) {
  const [state, action] = useActionState<ReminderActionState, FormData>(
    createReminderAction,
    null,
  )

  useEffect(() => {
    if (state?.ok) toast.success("Reminder scheduled")
  }, [state])

  return (
    <form action={action} className="grid gap-4">
      <ReminderFields
        emailDeliveryEnabled={emailDeliveryEnabled}
        idPrefix="create-reminder"
        quests={quests}
        timezone={timezone}
      />
      {state && !state.ok ? (
        <p aria-live="polite" className="text-sm text-danger" role="alert">
          {state.error.message}
        </p>
      ) : null}
      <div>
        <MutationSubmitButton
          idleLabel="Create reminder"
          pendingLabel="Creating reminder"
        />
      </div>
    </form>
  )
}

function ReminderRow({
  emailDeliveryEnabled,
  reminder,
  quests,
  timezone,
}: Readonly<{
  emailDeliveryEnabled: boolean
  reminder: ReminderView
  quests: readonly QuestOption[]
  timezone: string
}>) {
  const selectedDate = useSearchParams().get("date")
  const [state, action] = useActionState<ReminderActionState, FormData>(
    updateReminderAction,
    null,
  )
  const [isCancelling, startCancel] = useTransition()
  const editable =
    reminder.status === "pending" || reminder.status === "retrying"

  useEffect(() => {
    if (state?.ok) toast.success("Reminder updated")
  }, [state])

  return (
    <li className="rounded-panel border border-border-soft bg-surface-inset p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            <Link
              className="rounded-sm text-ink underline-offset-4 hover:text-system-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              href={questHomeHref(reminder.questId, selectedDate)}
            >
              {reminder.questTitle}
            </Link>
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {formatZonedDateTime(
              new Date(reminder.remindAt),
              reminder.timezone,
            )}{" "}
            · {reminder.channel === "email" ? "Email + in app" : "In app"}
          </p>
        </div>
        <Badge variant="outline">{reminder.status}</Badge>
      </div>

      {editable ? (
        <details className="mt-3">
          <summary className="motion-interactive w-fit cursor-pointer rounded-control px-2 py-1 text-sm font-medium text-system-blue focus-visible:outline-none">
            Edit reminder
          </summary>
          <form action={action} className="mt-3 grid gap-4">
            <input name="reminderId" type="hidden" value={reminder.id} />
            <input
              name="expectedVersion"
              type="hidden"
              value={reminder.version}
            />
            <ReminderFields
              channel={emailDeliveryEnabled ? reminder.channel : "in_app"}
              emailDeliveryEnabled={emailDeliveryEnabled}
              idPrefix={`edit-reminder-${reminder.id}`}
              questId={reminder.questId}
              quests={quests}
              remindAt={reminder.remindAt}
              timezone={timezone}
            />
            {state && !state.ok ? (
              <p className="text-sm text-danger" role="alert">
                {state.error.message}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <MutationSubmitButton
                idleLabel="Save reminder"
                pendingLabel="Saving reminder"
              />
              <Button
                disabled={isCancelling}
                onClick={() =>
                  startCancel(async () => {
                    const result = await cancelReminderAction({
                      expectedVersion: reminder.version,
                      reminderId: reminder.id,
                    })
                    if (result.ok) {
                      toast.success("Reminder cancelled")
                    } else {
                      toast.error(result.error.message)
                    }
                  })
                }
                type="button"
                variant="destructive"
              >
                <X aria-hidden="true" />
                {isCancelling ? "Cancelling" : "Cancel reminder"}
              </Button>
            </div>
          </form>
        </details>
      ) : null}
    </li>
  )
}

export function ReminderManager({
  emailDeliveryEnabled,
  quests,
  reminders,
  timezone,
}: Readonly<{
  emailDeliveryEnabled: boolean
  quests: readonly QuestOption[]
  reminders: readonly ReminderView[]
  timezone: string
}>) {
  return (
    <div className="grid gap-6">
      {quests.length ? (
        <CreateReminderForm
          emailDeliveryEnabled={emailDeliveryEnabled}
          quests={quests}
          timezone={timezone}
        />
      ) : (
        <p className="text-sm text-ink-muted">
          Create an active task before scheduling a reminder.
        </p>
      )}
      <div className="grid gap-3 border-t border-border-soft pt-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <BellRing aria-hidden="true" className="size-4" />
          Reminder schedule
        </h2>
        {reminders.length ? (
          <ul className="grid gap-3">
            {reminders.map((reminder) => (
              <ReminderRow
                emailDeliveryEnabled={emailDeliveryEnabled}
                key={reminder.id}
                quests={quests}
                reminder={reminder}
                timezone={timezone}
              />
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <CalendarClock aria-hidden="true" className="size-4" />
            No reminders have been scheduled.
          </p>
        )}
      </div>
    </div>
  )
}
