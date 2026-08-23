"use client"

import { useActionState, useEffect } from "react"
import { Tags } from "lucide-react"
import { toast } from "sonner"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  createLabelAction,
  type LabelActionState,
} from "@/features/labels/application/actions"
import { labelColorLabels } from "@/features/labels/components/label-color-styles"
import { labelColorTokens } from "@/features/labels/domain/types"

const initialState: LabelActionState = null

export function LabelCreateForm() {
  const [state, formAction] = useActionState(createLabelAction, initialState)

  useEffect(() => {
    if (state?.ok) {
      toast.success("Label created")
    }
  }, [state])

  const nameError =
    state && !state.ok ? state.error.fieldErrors?.name : undefined

  return (
    <Card className="border-border-soft bg-card/75 shadow-panel">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-control bg-system-blue/10 text-spectral-cyan">
            <Tags aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Create Label</CardTitle>
            <CardDescription>
              Attach Labels to tasks to cut across Lists and schedules.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
          className="grid gap-5"
          key={state?.ok ? state.data.id : "create-label"}
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="create-label-name">Label name</Label>
              <Input
                aria-describedby={
                  nameError ? "create-label-name-error" : undefined
                }
                aria-invalid={Boolean(nameError)}
                autoComplete="off"
                id="create-label-name"
                maxLength={60}
                name="name"
                placeholder="e.g. Deep focus, Errands"
                required
              />
              {nameError ? (
                <p
                  className="text-xs leading-5 text-danger"
                  id="create-label-name-error"
                >
                  {nameError[0]}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-label-color">Color</Label>
              <select
                className="h-8 w-full rounded-control border border-input bg-surface-inset px-2.5 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                defaultValue="system-blue"
                id="create-label-color"
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
                idleLabel="Create Label"
                pendingLabel="Creating Label"
              />
            </div>
          </div>
          {state && !state.ok ? (
            <p aria-live="polite" className="text-sm text-danger" role="alert">
              {state.error.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
