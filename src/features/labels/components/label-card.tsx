"use client"

import { useActionState, useEffect, useRef, useTransition } from "react"
import Link from "next/link"
import { ListChecks } from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/system/confirmation-dialog"
import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  deleteLabelAction,
  editLabelAction,
  type LabelActionState,
} from "@/features/labels/application/actions"
import {
  labelColorBadgeStyles,
  labelColorDotStyles,
  labelColorLabels,
} from "@/features/labels/components/label-color-styles"
import {
  labelColorTokens,
  type LabelView,
} from "@/features/labels/domain/types"

const initialEditState: LabelActionState = null

function LabelEditForm({ label }: Readonly<{ label: LabelView }>) {
  const [state, formAction] = useActionState(editLabelAction, initialEditState)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (state?.ok) {
      if (detailsRef.current) {
        detailsRef.current.open = false
      }
      toast.success("Label updated")
    }
  }, [state])

  const nameError =
    state && !state.ok ? state.error.fieldErrors?.name : undefined

  return (
    <details className="group/edit" ref={detailsRef}>
      <summary className="motion-interactive w-fit cursor-pointer rounded-control px-2 py-1 text-sm font-medium text-system-blue hover:text-spectral-cyan focus-visible:outline-none">
        Edit Label
      </summary>
      <form
        action={formAction}
        className="mt-4 grid gap-4 rounded-panel border border-border-soft bg-surface-inset p-4"
      >
        <input name="labelId" type="hidden" value={label.id} />
        <input name="expectedVersion" type="hidden" value={label.version} />
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`edit-label-${label.id}-name`}>Label name</Label>
            <Input
              aria-describedby={
                nameError ? `edit-label-${label.id}-name-error` : undefined
              }
              aria-invalid={Boolean(nameError)}
              autoComplete="off"
              defaultValue={label.name}
              id={`edit-label-${label.id}-name`}
              maxLength={60}
              name="name"
              required
            />
            {nameError ? (
              <p
                className="text-xs leading-5 text-danger"
                id={`edit-label-${label.id}-name-error`}
              >
                {nameError[0]}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-label-${label.id}-color`}>Color</Label>
            <select
              className="h-8 w-full rounded-control border border-input bg-surface-inset px-2.5 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              defaultValue={label.colorToken}
              id={`edit-label-${label.id}-color`}
              name="colorToken"
            >
              {labelColorTokens.map((token) => (
                <option key={token} value={token}>
                  {labelColorLabels[token]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <MutationSubmitButton
              idleLabel="Save changes"
              pendingLabel="Saving changes"
            />
          </div>
        </div>
        {state && !state.ok ? (
          <p aria-live="polite" className="text-sm text-danger" role="alert">
            {state.error.message}
          </p>
        ) : null}
      </form>
    </details>
  )
}

function LabelDeleteControl({ label }: Readonly<{ label: LabelView }>) {
  const [isPending, startTransition] = useTransition()

  function deleteLabel() {
    startTransition(async () => {
      try {
        const result = await deleteLabelAction({
          expectedVersion: label.version,
          labelId: label.id,
        })

        if (result.ok) {
          toast.success("Label deleted and detached from tasks")
        } else {
          toast.error(result.error.message)
        }
      } catch {
        toast.error("The Label could not be deleted. Refresh and retry.")
      }
    })
  }

  return (
    <ConfirmationDialog
      confirmLabel={isPending ? "Deleting Label" : "Delete Label"}
      description={`“${label.name}” will be removed and detached from every task that carries it. Tasks themselves are unaffected.`}
      onConfirm={deleteLabel}
      title="Delete this Label?"
      triggerLabel="Delete Label"
      variant="destructive"
    />
  )
}

export function LabelCard({ label }: Readonly<{ label: LabelView }>) {
  const titleId = `label-${label.id}-title`

  return (
    <div
      aria-labelledby={titleId}
      className="grid gap-4 rounded-panel border border-border-soft bg-card/78 p-5 shadow-panel"
      data-label-id={label.id}
      role="article"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`size-2.5 shrink-0 rounded-full ${labelColorDotStyles[label.colorToken]}`}
          />
          <h3 className="text-base font-semibold" id={titleId}>
            {label.name}
          </h3>
          <Badge
            className={labelColorBadgeStyles[label.colorToken]}
            variant="outline"
          >
            {labelColorLabels[label.colorToken]}
          </Badge>
        </div>
        <span className="font-mono text-xs text-ink-muted">
          v{label.version}
        </span>
      </div>

      <LabelEditForm label={label} />

      <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
        <Button asChild variant="outline">
          <Link href={`/quests?labelId=${label.id}`}>
            <ListChecks aria-hidden="true" />
            View labelled Tasks
          </Link>
        </Button>
        <LabelDeleteControl label={label} />
      </div>
    </div>
  )
}
