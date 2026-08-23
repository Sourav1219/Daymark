"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Archive, ArchiveRestore, ListChecks } from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/system/confirmation-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  archiveGateAction,
  restoreGateAction,
  softDeleteGateAction,
  type GateTransitionInput,
} from "@/features/gates/application/actions"
import {
  gateAccentBadgeStyles,
  gateAccentDotStyles,
  gateAccentLabels,
} from "@/features/gates/components/gate-accent-styles"
import { GateEditForm } from "@/features/gates/components/gate-edit-form"
import type { GateView } from "@/features/gates/domain/types"
import type { ActionResult } from "@/lib/actions/action-result"
import type { GateMutationSummary } from "@/features/gates/mutations/gate-mutation-service"

function resultToast(
  result: ActionResult<GateMutationSummary>,
  successMessage: string,
) {
  if (result.ok) {
    toast.success(successMessage)
  } else {
    toast.error(result.error.message)
  }
}

function GateArchiveControl({
  archived,
  input,
}: Readonly<{ archived: boolean; input: GateTransitionInput }>) {
  const [isPending, startTransition] = useTransition()

  function toggleArchive() {
    startTransition(async () => {
      try {
        const result = archived
          ? await restoreGateAction(input)
          : await archiveGateAction(input)
        resultToast(result, archived ? "List restored" : "List archived")
      } catch {
        toast.error(
          "The list request could not be completed. Refresh and retry.",
        )
      }
    })
  }

  return (
    <Button disabled={isPending} onClick={toggleArchive} variant="outline">
      {archived ? (
        <ArchiveRestore aria-hidden="true" />
      ) : (
        <Archive aria-hidden="true" />
      )}
      {isPending
        ? archived
          ? "Restoring List"
          : "Archiving List"
        : archived
          ? "Restore List"
          : "Archive List"}
    </Button>
  )
}

function GateDeleteControl({
  input,
  name,
  questCount,
}: Readonly<{
  input: GateTransitionInput
  name: string
  questCount: number
}>) {
  const [isPending, startTransition] = useTransition()

  if (questCount > 0) {
    return (
      <p className="text-xs text-ink-muted">
        Move its {questCount} task{questCount === 1 ? "" : "s"} to another List
        or No List to enable deletion. Restore trashed tasks first.
      </p>
    )
  }

  function deleteGate() {
    startTransition(async () => {
      try {
        const result = await softDeleteGateAction(input)
        resultToast(result, "List deleted")
      } catch {
        toast.error("The list could not be deleted. Refresh and retry.")
      }
    })
  }

  return (
    <ConfirmationDialog
      confirmLabel={isPending ? "Deleting List" : "Delete List"}
      description={`“${name}” will be removed from this workspace. Tasks are unaffected because the list is empty.`}
      onConfirm={deleteGate}
      title="Delete this list?"
      triggerLabel="Delete List"
      variant="destructive"
    />
  )
}

export function GateCard({ gate }: Readonly<{ gate: GateView }>) {
  const titleId = `gate-${gate.id}-title`
  const input = { expectedVersion: gate.version, gateId: gate.id }
  const archived = gate.archivedAt !== null

  return (
    <Card
      aria-labelledby={titleId}
      className="border-border-soft bg-card/78 shadow-panel"
      data-gate-id={gate.id}
      role="article"
    >
      <CardHeader className="border-b border-border-soft pb-4">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full ${gateAccentDotStyles[gate.accentToken]}`}
              />
              <CardTitle className="text-lg" id={titleId}>
                {gate.name}
              </CardTitle>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge
                className={gateAccentBadgeStyles[gate.accentToken]}
                variant="outline"
              >
                {gateAccentLabels[gate.accentToken]}
              </Badge>
              <Badge variant="outline">
                {archived ? "Archived" : "Active"}
              </Badge>
              <Badge variant="outline">
                {gate.questCount} task{gate.questCount === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>
          <span className="font-mono text-xs text-ink-muted">
            v{gate.version}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {gate.description ? (
          <p className="leading-6 text-ink-muted whitespace-pre-wrap">
            {gate.description}
          </p>
        ) : null}

        {!archived ? <GateEditForm gate={gate} /> : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
          <Button asChild variant="outline">
            <Link href={`/quests?gateId=${gate.id}`}>
              <ListChecks aria-hidden="true" />
              View Tasks
            </Link>
          </Button>
          <GateArchiveControl archived={archived} input={input} />
          <GateDeleteControl
            input={input}
            name={gate.name}
            questCount={gate.questCount}
          />
        </div>
      </CardContent>
    </Card>
  )
}
